/**
 * Tri-Tender VPS Worker
 *
 * Polls Supabase for queued jobs, claims them atomically,
 * executes bounded phase work, and writes results back.
 *
 * Runs under PM2 on the Hostinger/Hetzner VPS.
 *
 * Usage:
 *   node index.js                  # run once (exits after one poll cycle)
 *   node index.js --loop           # continuous polling loop
 *   node index.js --loop --interval 10  # poll every 10 seconds
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { downloadTenderFile, uploadOutputFile } from './storage.js'
import { executePhase } from './phases.js'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const WORKER_NAME = process.env.WORKER_NAME ?? `worker-${process.pid}`
const POLL_INTERVAL_S = parseInt(process.env.POLL_INTERVAL ?? '30', 10)
const LOOP_MODE = process.argv.includes('--loop')
const TROS_DIR = process.env.TROS_DIR ?? '/home/biddesk/TenderResponseOS'

const supabase = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
)

// ---------------------------------------------------------------------------
// Job event logging
// ---------------------------------------------------------------------------

async function logEvent(jobId, tenderId, eventType, message, meta = {}) {
  const { error } = await supabase.from('job_events').insert({
    job_id: jobId,
    tender_id: tenderId,
    event_type: eventType,
    message,
    meta,
  })
  if (error) console.error(`[event-log] Failed to log ${eventType}:`, error.message)
}

// ---------------------------------------------------------------------------
// Job status updates
// ---------------------------------------------------------------------------

async function updateJobStatus(jobId, status, extra = {}) {
  const update = { status, updated_at: new Date().toISOString(), ...extra }
  if (status === 'completed') update.completed_at = new Date().toISOString()
  if (status === 'failed') update.failed_at = new Date().toISOString()

  const { error } = await supabase.from('jobs').update(update).eq('id', jobId)
  if (error) console.error(`[job] Failed to update status to ${status}:`, error.message)
}

// ---------------------------------------------------------------------------
// Tender status updates
// ---------------------------------------------------------------------------

async function updateTenderPhase(tenderId, phase, phaseStatus) {
  const { error } = await supabase
    .from('tenders')
    .update({
      current_phase: phase,
      phase_status: phaseStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tenderId)
  if (error) console.error(`[tender] Failed to update phase:`, error.message)
}

// ---------------------------------------------------------------------------
// Next job creation
// ---------------------------------------------------------------------------

const PHASE_JOB_MAP = {
  2: { jobType: 'tender_intake', queueClass: 'medium' },
  3: { jobType: 'matrix_and_missing', queueClass: 'medium' },
  4: { jobType: 'response_strategy', queueClass: 'medium' },
  5: { jobType: 'draft_technical', queueClass: 'heavy' },
  6: { jobType: 'qa_gate', queueClass: 'medium' },
  7: { jobType: 'final_pack_generation', queueClass: 'heavy' },
}

async function createNextJob(job) {
  const nextPhase = job.phase + 1
  const mapping = PHASE_JOB_MAP[nextPhase]
  if (!mapping) {
    console.log(`[progression] No next phase after ${job.phase}`)
    return
  }

  // Check if the tender can enter the next phase
  const { data: gateRows, error: gateError } = await supabase.rpc(
    'tender_can_enter_phase',
    { p_tender_id: job.tender_id, p_target_phase: nextPhase },
  )

  if (gateError || !gateRows?.length) {
    console.error(`[progression] Gate check failed for phase ${nextPhase}`)
    return
  }

  const gate = gateRows[0]
  if (!gate.allowed) {
    console.log(`[progression] Phase ${nextPhase} blocked: ${gate.reason}`)
    // Update tender payment gate
    await supabase
      .from('tenders')
      .update({
        payment_gate: gate.required_payment_gate,
        phase_status: gate.required_payment_gate === 'none' ? 'in_progress' : 'awaiting_payment',
      })
      .eq('id', job.tender_id)

    await logEvent(job.id, job.tender_id, 'phase_gated', gate.reason, {
      nextPhase,
      gate: gate.required_payment_gate,
    })
    return
  }

  // Check if a job for this phase already exists
  const { data: existing } = await supabase
    .from('jobs')
    .select('id')
    .eq('tender_id', job.tender_id)
    .eq('phase', nextPhase)
    .in('status', ['queued', 'ready', 'running'])
    .limit(1)
    .maybeSingle()

  if (existing) {
    console.log(`[progression] Job already exists for phase ${nextPhase}`)
    return
  }

  const { error: insertError } = await supabase.from('jobs').insert({
    client_id: job.client_id,
    tender_id: job.tender_id,
    job_type: mapping.jobType,
    phase: nextPhase,
    queue_class: mapping.queueClass,
    status: 'queued',
    priority_score: job.priority_score,
    complexity_band: job.complexity_band,
    service_tier: job.service_tier,
    buyer_deadline: job.buyer_deadline,
    requested_by: job.requested_by,
  })

  if (insertError) {
    console.error(`[progression] Failed to create phase ${nextPhase} job:`, insertError.message)
    return
  }

  console.log(`[progression] Created ${mapping.jobType} job for phase ${nextPhase}`)
  await logEvent(job.id, job.tender_id, 'next_job_created', `Phase ${nextPhase} job queued`, {
    nextPhase,
    jobType: mapping.jobType,
  })
}

// ---------------------------------------------------------------------------
// Main job processor
// ---------------------------------------------------------------------------

async function processJob(job) {
  console.log(`\n[job] Processing ${job.job_type} (phase ${job.phase}) for tender ${job.tender_id}`)
  console.log(`[job] Queue: ${job.queue_class} | Priority: ${job.priority_score} | ID: ${job.id}`)

  await logEvent(job.id, job.tender_id, 'job_started', `Processing ${job.job_type}`)

  // Update tender to show it's actively being processed
  if (job.tender_id) {
    await updateTenderPhase(job.tender_id, job.phase, 'in_progress')
  }

  try {
    // Download tender file if needed
    let localFilePath = null
    if (job.payload?.storagePath) {
      localFilePath = await downloadTenderFile(supabase, job, TROS_DIR)
      await logEvent(job.id, job.tender_id, 'file_downloaded', 'Tender file downloaded to workspace')
    }

    // Execute the phase-specific work
    const result = await executePhase(supabase, job, TROS_DIR, localFilePath)

    // Upload any output files
    if (result.outputFiles?.length) {
      for (const file of result.outputFiles) {
        await uploadOutputFile(supabase, job, file)
      }
      await logEvent(job.id, job.tender_id, 'outputs_uploaded', `${result.outputFiles.length} output file(s) uploaded`)
    }

    // Update missing items if discovered
    if (result.missingItems?.length) {
      for (const item of result.missingItems) {
        await supabase.from('missing_items').insert({
          tender_id: job.tender_id,
          criticality: item.criticality ?? 'MEDIUM',
          category: item.category ?? 'general',
          description: item.description,
          responsible: item.responsible ?? 'client',
          resolved: false,
        })
      }
      await logEvent(job.id, job.tender_id, 'missing_items_found', `${result.missingItems.length} missing item(s) identified`)
    }

    // Update tender complexity if set during preflight
    if (result.complexityBand) {
      await supabase
        .from('tenders')
        .update({ complexity_band: result.complexityBand })
        .eq('id', job.tender_id)
    }

    // Update tender buyer/title if discovered during intake
    if (result.tenderUpdates) {
      await supabase
        .from('tenders')
        .update(result.tenderUpdates)
        .eq('id', job.tender_id)
    }

    // Mark job completed
    await updateJobStatus(job.id, 'completed')
    await logEvent(job.id, job.tender_id, 'job_completed', `${job.job_type} completed successfully`, {
      phase: job.phase,
      duration: Date.now() - new Date(job.started_at).getTime(),
    })

    // Update tender phase status
    if (result.blocked) {
      await updateTenderPhase(job.tender_id, job.phase, 'blocked')
      await logEvent(job.id, job.tender_id, 'tender_blocked', 'Tender blocked on missing mandatory items')
    } else if (job.phase === 7) {
      // Final phase — mark complete
      await updateTenderPhase(job.tender_id, 7, 'completed')
      await logEvent(job.id, job.tender_id, 'tender_complete', 'Tender submission pack ready')
    } else {
      // Try to progress to next phase
      await createNextJob(job)
    }

    console.log(`[job] Completed ${job.job_type} successfully`)
  } catch (error) {
    console.error(`[job] Failed ${job.job_type}:`, error.message)

    const isTransient = error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT' ||
      error.message?.includes('rate limit') ||
      error.message?.includes('timeout')

    if (isTransient && job.retry_count < job.max_retries) {
      await updateJobStatus(job.id, 'queued', {
        retry_count: job.retry_count + 1,
        last_error: error.message,
        locked_at: null,
        worker_name: null,
      })
      await logEvent(job.id, job.tender_id, 'job_retrying', `Retry ${job.retry_count + 1}/${job.max_retries}: ${error.message}`)
      console.log(`[job] Retrying (${job.retry_count + 1}/${job.max_retries})`)
    } else {
      await updateJobStatus(job.id, 'failed', { last_error: error.message })
      await logEvent(job.id, job.tender_id, 'job_failed', error.message, {
        phase: job.phase,
        retryCount: job.retry_count,
        stack: error.stack,
      })

      if (job.tender_id) {
        await updateTenderPhase(job.tender_id, job.phase, 'failed')
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Poll cycle
// ---------------------------------------------------------------------------

async function pollOnce() {
  const queueClasses = ['heavy', 'medium', 'light']

  for (const queueClass of queueClasses) {
    const { data: jobs, error } = await supabase.rpc('claim_next_biddesk_job', {
      p_worker_name: WORKER_NAME,
      p_queue_class: queueClass,
    })

    if (error) {
      console.error(`[poll] claim_next_biddesk_job(${queueClass}) error:`, error.message)
      continue
    }

    if (!jobs?.length) continue

    const job = jobs[0]
    await processJob(job)
    return true // Processed a job — poll again immediately
  }

  return false // No jobs found
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n========================================`)
  console.log(`Tri-Tender Worker: ${WORKER_NAME}`)
  console.log(`Mode: ${LOOP_MODE ? 'continuous' : 'single poll'}`)
  console.log(`Poll interval: ${POLL_INTERVAL_S}s`)
  console.log(`TROS dir: ${TROS_DIR}`)
  console.log(`========================================\n`)

  if (!LOOP_MODE) {
    const processed = await pollOnce()
    console.log(processed ? '[done] Job processed' : '[done] No jobs found')
    return
  }

  // Continuous loop
  while (true) {
    try {
      const processed = await pollOnce()
      if (processed) {
        // If we processed a job, poll again immediately
        continue
      }
    } catch (error) {
      console.error('[loop] Unexpected error:', error.message)
    }

    // Sleep before next poll
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_S * 1000))
  }
}

main().catch((err) => {
  console.error('[fatal]', err)
  process.exit(1)
})
