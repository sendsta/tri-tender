import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, CheckCircle2, Clock, Ban } from 'lucide-react'
import Link from 'next/link'

const activationIcons = {
  active: CheckCircle2,
  pending_setup_payment: Clock,
  suspended: Ban,
}

const activationColors = {
  active: 'text-emerald-500',
  pending_setup_payment: 'text-amber-500',
  suspended: 'text-destructive',
}

export default async function AdminClientsPage() {
  const supabase = await createClient()

  const { data: clients } = await supabase
    .from('clients')
    .select('id, client_id_slug, legal_name, trading_name, tier, status, activation_status, service_tier, contact_email, sector, bbbee_level, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
        <p className="text-muted-foreground">All registered client companies</p>
      </div>

      {!clients || clients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Building2 className="h-12 w-12 text-muted-foreground/40" />
            <h3 className="font-semibold">No clients yet</h3>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{clients.length} client{clients.length !== 1 ? 's' : ''}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {clients.map((client) => {
                const Icon = activationIcons[client.activation_status as keyof typeof activationIcons] ?? Clock
                const iconColor = activationColors[client.activation_status as keyof typeof activationColors] ?? ''

                return (
                  <Link
                    key={client.id}
                    href={`/admin/clients/${client.id}`}
                    className="flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`h-5 w-5 ${iconColor}`} />
                      <div>
                        <p className="text-sm font-medium">{client.legal_name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{client.client_id_slug}</span>
                          {client.contact_email && (
                            <>
                              <span>&middot;</span>
                              <span>{client.contact_email}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{client.service_tier}</Badge>
                      <Badge variant="outline" className="text-[10px]">{client.activation_status}</Badge>
                    </div>
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
