import { apiError, apiOk } from '@/lib/biddesk/responses'
import { requirePortalContext } from '@/lib/biddesk/server'

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: jobId } = await params
    const { supabase, clientId } = await requirePortalContext()

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select(
        'id, status, phase, queue_class, priority_score, tender_id, created_at, started_at, completed_at',
      )
      .eq('id', jobId)
      .eq('client_id', clientId)
      .single()

    if (jobError || !job) {
      return apiError('NOT_FOUND', 'Job not found', 404)
    }

    const { data: events, error: eventsError } = await supabase
      .from('job_events')
      .select('event_type, message, created_at')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(25)

    if (eventsError) {
      return apiError('INTERNAL_ERROR', 'Failed to load job events', 500)
    }

    return apiOk({
      jobId: job.id,
      status: job.status,
      phase: job.phase,
      queueClass: job.queue_class,
      priorityScore: job.priority_score,
      tenderId: job.tender_id,
      createdAt: job.created_at,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      events:
        events?.map((event) => ({
          eventType: event.event_type,
          message: event.message,
          createdAt: event.created_at,
        })) ?? [],
    })
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
