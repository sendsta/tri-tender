import { apiError, apiOk } from '@/lib/biddesk/responses'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: leadId } = await params
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

  const body = await request.json()
  const status = body.status as string
  const validStatuses = ['new', 'contacted', 'qualified', 'converted', 'lost']

  if (!validStatuses.includes(status)) {
    return apiError('INVALID_INPUT', `Status must be one of: ${validStatuses.join(', ')}`, 400)
  }

  const { data: lead, error } = await supabase
    .from('leads')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', leadId)
    .select('id, status')
    .single()

  if (error || !lead) {
    return apiError('NOT_FOUND', 'Lead not found', 404)
  }

  return apiOk(lead)
}
