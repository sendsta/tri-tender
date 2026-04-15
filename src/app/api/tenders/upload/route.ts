import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/biddesk/responses'
import { requirePortalContext } from '@/lib/biddesk/server'

function derivePriority(deadline?: string | null) {
  if (!deadline) return 10
  const due = new Date(deadline).getTime()
  const now = Date.now()
  const hours = Math.max(1, Math.floor((due - now) / 36e5))
  if (hours <= 24) return 100
  if (hours <= 72) return 80
  return 40
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, clientId } = await requirePortalContext()
    const body = await request.json()

    const title = body.title as string | undefined
    const fileName = body.fileName as string | undefined
    const storagePath = body.storagePath as string | undefined
    const mimeType = body.mimeType as string | undefined
    const sizeBytes = body.sizeBytes as number | undefined
    const deadline = body.deadline as string | undefined

    if (!title || !fileName || !storagePath) {
      return apiError('INVALID_INPUT', 'title, fileName, and storagePath are required', 400)
    }

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('activation_status, service_tier, max_queued_tenders')
      .eq('id', clientId)
      .single()

    if (clientError || !client) {
      return apiError('NOT_FOUND', 'Client not found', 404)
    }

    if (client.activation_status !== 'active') {
      return apiError('SETUP_REQUIRED', 'Setup payment required before tender submission', 402)
    }

    const { count: queuedCount } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .in('status', ['queued', 'preflight', 'ready', 'awaiting_payment', 'running'])

    if ((queuedCount ?? 0) >= client.max_queued_tenders) {
      return apiError('CONFLICT', 'Tender queue limit reached for this client', 409)
    }

    // Generate tender number and slug
    const tenderNumber = `T${Date.now().toString(36).toUpperCase()}`
    const slugBase = title.replace(/[^a-zA-Z0-9]+/g, '_').substring(0, 40)
    const tenderIdSlug = `${tenderNumber}_${slugBase}`

    const { data: tender, error: tenderError } = await supabase
      .from('tenders')
      .insert({
        client_id: clientId,
        tender_id_slug: tenderIdSlug,
        tender_number: tenderNumber,
        tender_title: title,
        buyer: 'TBD',
        deadline,
        created_by: user.id,
        current_phase: 1,
        phase_status: 'in_progress',
        payment_gate: 'quote_acceptance_required',
        payment_state: 'awaiting_quote',
        queue_class: 'medium',
      })
      .select('id')
      .single()

    if (tenderError || !tender) {
      return apiError('INTERNAL_ERROR', 'Failed to create tender', 500)
    }

    const { error: fileError } = await supabase.from('tender_files').insert({
      tender_id: tender.id,
      client_id: clientId,
      file_type: 'input',
      filename: fileName,
      storage_path: storagePath,
      mime_type: mimeType,
      file_size_bytes: sizeBytes,
      uploaded_by: user.id,
    })

    if (fileError) {
      return apiError('UPLOAD_FAILED', 'Failed to register uploaded file', 500)
    }

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        client_id: clientId,
        tender_id: tender.id,
        job_type: 'tender_preflight',
        phase: 1,
        queue_class: 'medium',
        status: 'preflight',
        priority_score: derivePriority(deadline),
        payment_gate: 'none',
        requested_by: user.id,
        service_tier: client.service_tier,
        buyer_deadline: deadline,
        payload: {
          source: 'portal_upload',
          storagePath,
          fileName,
        },
      })
      .select('id, status')
      .single()

    if (jobError || !job) {
      return apiError('INTERNAL_ERROR', 'Failed to create preflight job', 500)
    }

    await supabase.from('job_events').insert({
      job_id: job.id,
      tender_id: tender.id,
      event_type: 'preflight_created',
      message: 'Preflight job created from portal upload',
      meta: { uploadedBy: user.id },
    })

    return apiOk(
      {
        tenderId: tender.id,
        jobId: job.id,
        status: job.status,
        paymentGate: 'quote_acceptance_required',
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
