import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PortalShell } from '@/components/portal-shell'
import { PaymentCallback } from '@/components/payment-callback'

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

  const { data: membership } = await supabase
    .from('client_memberships')
    .select('client_id, membership_role')
    .eq('profile_id', user.id)
    .limit(1)
    .maybeSingle()

  let companyName = 'Your Company'
  let activationStatus = 'pending_setup_payment'
  if (membership?.client_id) {
    const { data: client } = await supabase
      .from('clients')
      .select('legal_name, activation_status')
      .eq('id', membership.client_id)
      .single()
    if (client?.legal_name) companyName = client.legal_name
    if (client?.activation_status) activationStatus = client.activation_status
  }

  const displayName = user.user_metadata?.full_name ?? user.email ?? 'User'

  return (
    <PortalShell
      user={{ email: user.email ?? '', displayName }}
      companyName={companyName}
    >
      <Suspense>
        <PaymentCallback />
      </Suspense>
      {children}
    </PortalShell>
  )
}
