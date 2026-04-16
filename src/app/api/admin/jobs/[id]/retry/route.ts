import { apiError, apiOk } from '@/lib/biddesk/responses'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('UNAUTHORIZED', 'Auth required', 401)

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['platform_admin', 'admin', 'operator'].includes(profile.role)) {
    return apiError('FORBIDDEN', 'Admin access required', 403)
  }

  const { data: job, error } = await supabase
    .from('jobs')
    .update({
      status: 'queued',
      retry_count: 0,
      last_error: null,
      locked_at: null,
      worker_name: null,
      failed_at: null,
    })
    .eq('id', jobId)
    .eq('status', 'failed')
    .select('id, status')
    .single()

  if (error || !job) {
    return apiError('NOT_FOUND', 'Failed job not found or not in failed state', 404)
  }

  await supabase.from('job_events').insert({
    job_id: jobId,
    event_type: 'job_retried',
    message: `Job manually retried by ${user.email}`,
    meta: { retriedBy: user.id },
  })

  return apiOk({ jobId: job.id, status: 'queued' })
}
