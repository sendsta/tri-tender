import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { StatusBadge } from '@/components/status-badge'
import {
  User,
  Building2,
  Shield,
  CreditCard,
  CheckCircle2,
  Clock,
} from 'lucide-react'

function formatCents(cents: number) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 0,
  }).format(cents / 100)
}

export default async function AccountPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', user.id)
    .single()

  const { data: membership } = await supabase
    .from('client_memberships')
    .select('client_id, membership_role')
    .eq('profile_id', user.id)
    .limit(1)
    .maybeSingle()

  let client = null
  if (membership?.client_id) {
    const { data } = await supabase
      .from('clients')
      .select('id, legal_name, trading_name, activation_status, service_tier, setup_fee_amount_cents, setup_fee_credit_remaining_cents, setup_activated_at, contact_email, bbbee_level, sector')
      .eq('id', membership.client_id)
      .single()
    client = data
  }

  const isActive = client?.activation_status === 'active'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account</h1>
        <p className="text-muted-foreground">
          Your profile and company information
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Profile</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Name</span>
              <span className="text-sm font-medium">{profile?.full_name ?? '—'}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="text-sm font-medium">{profile?.email ?? user.email}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Role</span>
              <Badge variant="outline">{membership?.membership_role ?? 'member'}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Company Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Company</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {client ? (
              <>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Legal Name</span>
                  <span className="text-sm font-medium">{client.legal_name}</span>
                </div>
                {client.trading_name && (
                  <>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Trading As</span>
                      <span className="text-sm font-medium">{client.trading_name}</span>
                    </div>
                  </>
                )}
                <Separator />
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Service Tier</span>
                  <Badge variant="outline" className="capitalize">{client.service_tier}</Badge>
                </div>
                {client.sector && (
                  <>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Sector</span>
                      <span className="text-sm font-medium">{client.sector}</span>
                    </div>
                  </>
                )}
                {client.bbbee_level && (
                  <>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">B-BBEE Level</span>
                      <span className="text-sm font-medium">Level {client.bbbee_level}</span>
                    </div>
                  </>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No company linked</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activation Card */}
      {client && (
        <Card className={!isActive ? 'border-amber-200 bg-amber-50/30' : ''}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Account Activation</CardTitle>
              </div>
              {isActive ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                  <Clock className="h-3 w-3" />
                  Pending
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isActive ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Your account was activated on{' '}
                  {client.setup_activated_at
                    ? new Date(client.setup_activated_at).toLocaleDateString()
                    : 'N/A'}
                </p>
                {client.setup_fee_credit_remaining_cents > 0 && (
                  <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3">
                    <CreditCard className="h-4 w-4 text-emerald-600" />
                    <p className="text-sm text-emerald-800">
                      {formatCents(client.setup_fee_credit_remaining_cents)} setup credit remaining — applied automatically to your first tender
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm">
                  A one-time setup fee of <strong>{formatCents(client.setup_fee_amount_cents)}</strong> is
                  required to activate your account and begin submitting tenders.
                </p>
                <p className="text-xs text-muted-foreground">
                  This amount is credited against your first tender — it is not an additional charge.
                </p>
                <Button disabled className="w-full sm:w-auto">
                  <CreditCard className="mr-2 h-4 w-4" />
                  Pay {formatCents(client.setup_fee_amount_cents)} Setup Fee
                </Button>
                <p className="text-xs text-muted-foreground">Paystack integration coming soon</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
