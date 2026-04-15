import { createClient } from '@/lib/supabase/server'

export async function requirePortalContext() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('UNAUTHORIZED')
  }

  const { data: membership, error } = await supabase
    .from('client_memberships')
    .select('client_id, membership_role')
    .eq('profile_id', user.id)
    .limit(1)
    .maybeSingle()

  if (error || !membership) {
    throw new Error('FORBIDDEN')
  }

  return {
    supabase,
    user,
    clientId: membership.client_id as string,
    membershipRole: membership.membership_role as string,
  }
}
