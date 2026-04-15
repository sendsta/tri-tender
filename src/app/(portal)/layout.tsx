import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PortalShell } from '@/components/portal-shell'

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch profile + membership for the shell
  const { data: membership } = await supabase
    .from('client_memberships')
    .select('client_id, membership_role')
    .eq('profile_id', user.id)
    .limit(1)
    .maybeSingle()

  let companyName = 'Your Company'
  if (membership?.client_id) {
    const { data: client } = await supabase
      .from('clients')
      .select('legal_name')
      .eq('id', membership.client_id)
      .single()
    if (client?.legal_name) companyName = client.legal_name
  }

  const displayName = user.user_metadata?.full_name ?? user.email ?? 'User'

  return (
    <PortalShell
      user={{ email: user.email ?? '', displayName }}
      companyName={companyName}
    >
      {children}
    </PortalShell>
  )
}
