import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { StatusBadge } from '@/components/status-badge'
import { Building2, FileText, Users, CreditCard } from 'lucide-react'

export default async function AdminClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  if (!client) return notFound()

  const [{ data: tenders }, { data: memberships }, { data: payments }] = await Promise.all([
    supabase
      .from('tenders')
      .select('id, tender_title, buyer, deadline, phase_status, current_phase, complexity_band, created_at')
      .eq('client_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('client_memberships')
      .select('id, membership_role, profile_id, profiles(email, full_name)')
      .eq('client_id', id),
    supabase
      .from('setup_payments')
      .select('id, amount_cents, status, paid_at, created_at')
      .eq('client_id', id)
      .order('created_at', { ascending: false }),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{client.legal_name}</h1>
          <p className="text-muted-foreground">{client.client_id_slug} &middot; {client.service_tier}</p>
        </div>
        <Badge
          variant={client.activation_status === 'active' ? 'default' : 'outline'}
          className={client.activation_status === 'active' ? 'bg-emerald-500' : ''}
        >
          {client.activation_status}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Company Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Company</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              ['Legal Name', client.legal_name],
              ['Trading Name', client.trading_name],
              ['Tier', client.tier],
              ['Sector', client.sector],
              ['B-BBEE Level', client.bbbee_level ? `Level ${client.bbbee_level}` : null],
              ['Contact', client.contact_email],
              ['Phone', client.contact_phone],
            ]
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <div key={label as string} className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
          </CardContent>
        </Card>

        {/* Members */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Members ({memberships?.length ?? 0})</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {!memberships?.length ? (
              <p className="text-sm text-muted-foreground">No members</p>
            ) : (
              <div className="space-y-2">
                {memberships.map((m) => {
                  const profile = (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) as { email: string; full_name: string } | null
                  return (
                    <div key={m.id} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium">{profile?.full_name ?? 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{profile?.email}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{m.membership_role}</Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payments */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Setup Payments</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {!payments?.length ? (
              <p className="text-sm text-muted-foreground">No payments</p>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span>R{((p.amount_cents ?? 0) / 100).toFixed(0)}</span>
                    <Badge
                      variant={p.status === 'paid' ? 'default' : 'outline'}
                      className={p.status === 'paid' ? 'bg-emerald-500' : ''}
                    >
                      {p.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tenders */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Tenders ({tenders?.length ?? 0})</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!tenders?.length ? (
            <p className="px-6 py-8 text-sm text-muted-foreground text-center">No tenders</p>
          ) : (
            <div className="divide-y">
              {tenders.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm font-medium">{t.tender_title ?? 'Untitled'}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.buyer ?? 'TBD'}
                      {t.deadline && ` · Due ${new Date(t.deadline).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.complexity_band && (
                      <Badge variant="outline" className="text-[10px]">{t.complexity_band}</Badge>
                    )}
                    <StatusBadge status={t.phase_status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
