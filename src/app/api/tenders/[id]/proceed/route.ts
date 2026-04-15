import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/biddesk/responses'
import { requirePortalContext } from '@/lib/biddesk/server'

function mapPhaseToJobType(phase: number) {
  switch (phase) {
    case 4:
      return { jobType: 'response_strategy', queueClass: 'medium' as const }
    case 5:
      return { jobType: 'draft_technical', queueClass: 'heavy' as const }
    case 6:
      return { jobType: 'qa_gate', queueClass: 'medium' as const }
    case 7:
      return { jobType: 'final_pack_generation', queueClass: 'heavy' as const }
    default:
      return null
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: tenderId } = await params
    const { supabase, user, clientId } = await requirePortalContext()
    const body = await request.json()
    const requestedPhase = Number(body.requestedPhase)

    if (!Number.isFinite(requestedPhase)) {
      return apiError('INVALID_INPUT', 'requestedPhase is required', 400)
    }

    const phaseMapping = mapPhaseToJobType(requestedPhase)
    if (!phaseMapping) {
      return apiError('INVALID_INPUT', 'Unsupported requestedPhase', 400)
    }

    const { data: tender, error: tenderError } = await supabase
      .from('tenders')
      .select('id, client_id, deadline, complexity_band')
      .eq('id', tenderId)
      .eq('client_id', clientId)
      .single()

    if (tenderError || !tender) {
      return apiError('NOT_FOUND', 'Tender not found', 404)
    }

    const { data: gateRows, error: gateError } = await supabase.rpc(
      'tender_can_enter_phase',
      {
        p_tender_id: tenderId,
        p_target_phase: requestedPhase,
      },
    )

    if (gateError || !gateRows || gateRows.length === 0) {
      return apiError('INTERNAL_ERROR', 'Failed to validate tender progression', 500)
    }

    const gate = gateRows[0]
    if (!gate.allowed) {
      const code =
        gate.required_payment_gate === 'quote_acceptance_required'
          ? 'QUOTE_REQUIRED'
          : gate.required_payment_gate === 'setup_required'
            ? 'SETUP_REQUIRED'
            : 'PAYMENT_REQUIRED'

      return apiError(code, gate.reason ?? 'Tender cannot proceed yet', 409)
    }

    const { data: existingJob } = await supabase
      .from('jobs')
      .select('id, status')
      .eq('tender_id', tenderId)
      .eq('phase', requestedPhase)
      .in('status', ['queued', 'ready', 'running'])
      .limit(1)
      .maybeSingle()

    if (existingJob) {
      return apiOk({
        tenderId,
        jobId: existingJob.id,
        nextPhase: requestedPhase,
        status: existingJob.status,
      })
    }

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        client_id: clientId,
        tender_id: tenderId,
        job_type: phaseMapping.jobType,
        phase: requestedPhase,
        queue_class: phaseMapping.queueClass,
        status: 'queued',
        priority_score: 50,
        complexity_band: tender.complexity_band,
        requested_by: user.id,
        buyer_deadline: tender.deadline,
      })
      .select('id, status')
      .single()

    if (jobError || !job) {
      return apiError('INTERNAL_ERROR', 'Failed to queue next job', 500)
    }

    await supabase.from('job_events').insert({
      job_id: job.id,
      tender_id: tenderId,
      event_type: 'job_queued',
      message: `Phase ${requestedPhase} job queued from portal`,
      meta: { requestedBy: user.id },
    })

    return apiOk(
      {
        tenderId,
        jobId: job.id,
        nextPhase: requestedPhase,
        status: job.status,
      },
      201,
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return apiError('UNAUTHORIZED', 'Authentication required', 401)
    }

    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return apiError('FORBIDDEN', 'Client membership required', 403)
    }

    return apiError('INTERNAL_ERROR', 'Unexpected error', 500)
  }
}
