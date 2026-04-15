/**
 * Phase executors for the Tri-Tender worker.
 *
 * Each phase function receives the job, Supabase client, TROS directory,
 * and local file path (if downloaded). Returns a result object with:
 * - complexityBand: string | null — set during preflight
 * - missingItems: array — items discovered during matrix phase
 * - outputFiles: array — { localPath, filename, fileType, mimeType }
 * - blocked: boolean — whether the tender is blocked
 * - tenderUpdates: object — fields to update on the tender record
 */

import fs from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

/**
 * Route a job to the correct phase executor.
 */
export async function executePhase(supabase, job, trosDir, localFilePath) {
  switch (job.job_type) {
    case 'tender_preflight':
      return executePreflight(supabase, job, trosDir, localFilePath)
    case 'tender_intake':
      return executeIntake(supabase, job, trosDir, localFilePath)
    case 'matrix_and_missing':
      return executeMatrix(supabase, job, trosDir, localFilePath)
    case 'response_strategy':
      return executeStrategy(supabase, job, trosDir)
    case 'draft_technical':
      return executeDrafting(supabase, job, trosDir)
    case 'qa_gate':
      return executeQA(supabase, job, trosDir)
    case 'final_pack_generation':
      return executeFinalPack(supabase, job, trosDir)
    default:
      console.log(`[phase] Unknown job type: ${job.job_type}, treating as no-op`)
      return { outputFiles: [], missingItems: [], blocked: false }
  }
}

// ---------------------------------------------------------------------------
// Phase 1: Preflight
// ---------------------------------------------------------------------------

async function executePreflight(supabase, job, trosDir, localFilePath) {
  console.log('[phase:preflight] Analyzing tender document...')

  // Estimate complexity from file size and type as a baseline
  let complexityBand = 'M' // Default to Medium
  let fileSize = 0

  if (localFilePath) {
    try {
      const stats = await fs.stat(localFilePath)
      fileSize = stats.size

      // Simple heuristic based on file size
      if (fileSize < 500_000) complexityBand = 'S'        // < 500KB
      else if (fileSize < 2_000_000) complexityBand = 'M'  // < 2MB
      else if (fileSize < 10_000_000) complexityBand = 'L'  // < 10MB
      else complexityBand = 'XL'                           // >= 10MB

      console.log(`[phase:preflight] File size: ${(fileSize / 1024 / 1024).toFixed(1)}MB → Complexity: ${complexityBand}`)
    } catch {
      console.log('[phase:preflight] Could not stat file, defaulting to M')
    }
  }

  // Create a preflight quote
  const pricingMap = { S: 250000, M: 500000, L: 1000000, XL: 2000000 } // cents
  const priceCents = pricingMap[complexityBand] ?? 500000
  const depositRequired = complexityBand === 'L' || complexityBand === 'XL'

  const { data: quote, error: quoteError } = await supabase
    .from('tender_quotes')
    .insert({
      tender_id: job.tender_id,
      client_id: job.client_id,
      complexity_band: complexityBand,
      price_cents: priceCents,
      deposit_required: depositRequired,
      deposit_cents: depositRequired ? Math.round(priceCents * 0.5) : null,
      balance_cents: depositRequired ? Math.round(priceCents * 0.5) : null,
      rush_available: true,
      rush_fee_cents: Math.round(priceCents * 0.3),
      turnaround_summary: getTurnaroundEstimate(complexityBand),
      status: 'presented',
      valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      created_by: null,
    })
    .select('id')
    .single()

  if (quoteError) {
    console.error('[phase:preflight] Failed to create quote:', quoteError.message)
  } else {
    // Update tender with the quote
    await supabase
      .from('tenders')
      .update({
        complexity_band: complexityBand,
        latest_quote_id: quote.id,
        quote_status: 'presented',
        payment_gate: 'quote_acceptance_required',
        payment_state: 'awaiting_quote_acceptance',
        deposit_required: depositRequired,
      })
      .eq('id', job.tender_id)

    console.log(`[phase:preflight] Quote created: ${complexityBand} @ R${(priceCents / 100).toLocaleString()}`)
  }

  return {
    complexityBand,
    outputFiles: [],
    missingItems: [],
    blocked: false,
    tenderUpdates: {
      complexity_band: complexityBand,
      queue_class: complexityBand === 'XL' ? 'heavy' : complexityBand === 'L' ? 'heavy' : 'medium',
    },
  }
}

function getTurnaroundEstimate(band) {
  switch (band) {
    case 'S': return '2-3 business days'
    case 'M': return '3-5 business days'
    case 'L': return '5-8 business days'
    case 'XL': return '8-12 business days'
    default: return '5-7 business days'
  }
}

// ---------------------------------------------------------------------------
// Phase 2: Intake & Classification
// ---------------------------------------------------------------------------

async function executeIntake(supabase, job, trosDir, localFilePath) {
  console.log('[phase:intake] Running tender intake and classification...')

  // Get client info for TenderResponseOS folder mapping
  const { data: client } = await supabase
    .from('clients')
    .select('client_code, client_id_slug')
    .eq('id', job.client_id)
    .single()

  const { data: tender } = await supabase
    .from('tenders')
    .select('tender_id_slug')
    .eq('id', job.tender_id)
    .single()

  if (!client || !tender) {
    throw new Error('Client or tender not found for intake')
  }

  const clientCode = client.client_code ?? client.client_id_slug
  const projectDir = path.join(trosDir, 'clients', clientCode, 'working', 'projects', tender.tender_id_slug)

  // Scaffold project directories
  const dirs = [
    '01_intake', '02_matrix', '03_strategy', '04_drafts',
    '05_evidence', '06_qa', '07_final',
  ]
  for (const dir of dirs) {
    await fs.mkdir(path.join(projectDir, dir), { recursive: true })
  }
  console.log(`[phase:intake] Project scaffolded at ${projectDir}`)

  return {
    outputFiles: [],
    missingItems: [],
    blocked: false,
    tenderUpdates: {
      buyer: 'TBD', // Will be extracted from document in a real implementation
    },
  }
}

// ---------------------------------------------------------------------------
// Phase 3: Matrix & Missing Items
// ---------------------------------------------------------------------------

async function executeMatrix(supabase, job, trosDir) {
  console.log('[phase:matrix] Building requirement matrix and checking compliance...')

  // In a real implementation, this would:
  // 1. Parse the tender document
  // 2. Extract requirements
  // 3. Cross-reference with client evidence library
  // 4. Identify mandatory missing items

  // For now, return empty — no blocking items
  return {
    outputFiles: [],
    missingItems: [],
    blocked: false,
  }
}

// ---------------------------------------------------------------------------
// Phase 4: Response Strategy
// ---------------------------------------------------------------------------

async function executeStrategy(supabase, job, trosDir) {
  console.log('[phase:strategy] Generating response strategy...')

  return {
    outputFiles: [],
    missingItems: [],
    blocked: false,
  }
}

// ---------------------------------------------------------------------------
// Phase 5: Drafting (HEAVY)
// ---------------------------------------------------------------------------

async function executeDrafting(supabase, job, trosDir) {
  console.log('[phase:drafting] Drafting tender response sections...')

  // This is the expensive phase — would invoke Claude API via TenderResponseOS
  // For now, placeholder
  return {
    outputFiles: [],
    missingItems: [],
    blocked: false,
  }
}

// ---------------------------------------------------------------------------
// Phase 6: QA Gate
// ---------------------------------------------------------------------------

async function executeQA(supabase, job, trosDir) {
  console.log('[phase:qa] Running QA checks...')

  return {
    outputFiles: [],
    missingItems: [],
    blocked: false,
  }
}

// ---------------------------------------------------------------------------
// Phase 7: Final Pack Generation (HEAVY)
// ---------------------------------------------------------------------------

async function executeFinalPack(supabase, job, trosDir) {
  console.log('[phase:final] Generating final submission pack...')

  // Get client and tender info for paths
  const { data: client } = await supabase
    .from('clients')
    .select('client_code, client_id_slug')
    .eq('id', job.client_id)
    .single()

  const { data: tender } = await supabase
    .from('tenders')
    .select('tender_id_slug, tender_title')
    .eq('id', job.tender_id)
    .single()

  if (!client || !tender) {
    throw new Error('Client or tender not found for final pack')
  }

  const clientCode = client.client_code ?? client.client_id_slug
  const projectDir = path.join(trosDir, 'clients', clientCode, 'working', 'projects', tender.tender_id_slug)
  const finalDir = path.join(projectDir, '07_final')
  await fs.mkdir(finalDir, { recursive: true })

  // Generate a placeholder final pack summary
  const summaryContent = `# Submission Pack Summary\n\nTender: ${tender.tender_title}\nGenerated: ${new Date().toISOString()}\nStatus: Ready for submission\n`
  const summaryPath = path.join(finalDir, 'submission_summary.md')
  await fs.writeFile(summaryPath, summaryContent)

  return {
    outputFiles: [
      {
        localPath: summaryPath,
        filename: 'submission_summary.md',
        fileType: 'final',
        mimeType: 'text/markdown',
      },
    ],
    missingItems: [],
    blocked: false,
  }
}
