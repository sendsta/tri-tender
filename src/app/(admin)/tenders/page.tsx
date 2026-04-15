import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge, PaymentBadge } from '@/components/status-badge'
import { FileText, Clock } from 'lucide-react'

export default async function AdminTendersPage() {
  const supabase = await createClient()

  // Admin sees ALL tenders across all clients (RLS allows via is_platform_admin())
  const { data: tenders } = await supabase
    .from('tenders')
    .select('id, tender_title, tender_id_slug, buyer, deadline, phase_status, payment_state, current_phase, complexity_band, client_id, created_at, clients(legal_name)')
    .order('created_at', { ascending: false })
    .limit(100)

  const activeCount = tenders?.filter((t) => t.phase_status !== 'complete' && t.phase_status !== 'failed' && t.phase_status !== 'no_bid').length ?? 0
  const blockedCount = tenders?.filter((t) => t.phase_status === 'blocked').length ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">All Tenders</h1>
          <p className="text-muted-foreground">Cross-client tender pipeline</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{activeCount} active</Badge>
          {blockedCount > 0 && <Badge variant="destructive">{blockedCount} blocked</Badge>}
        </div>
      </div>

      {!tenders || tenders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <FileText className="h-12 w-12 text-muted-foreground/40" />
            <h3 className="font-semibold">No tenders in the system</h3>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tenders.length} tender{tenders.length !== 1 ? 's' : ''}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-6 py-3 font-medium">Tender</th>
                    <th className="px-4 py-3 font-medium">Client</th>
                    <th className="px-4 py-3 font-medium">Deadline</th>
                    <th className="px-4 py-3 font-medium">Phase</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Payment</th>
                    <th className="px-4 py-3 font-medium">Band</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {tenders.map((t) => {
                    const clientName = ((Array.isArray(t.clients) ? t.clients[0] : t.clients) as { legal_name: string } | null)?.legal_name ?? '—'
                    let daysLeft: number | null = null
                    if (t.deadline) {
                      daysLeft = Math.ceil((new Date(t.deadline).getTime() - Date.now()) / 86400000)
                    }

                    return (
                      <tr key={t.id} className="hover:bg-muted/50">
                        <td className="px-6 py-3">
                          <p className="font-medium">{t.tender_title ?? 'Untitled'}</p>
                          <p className="text-xs text-muted-foreground">{t.buyer ?? 'TBD'}</p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{clientName}</td>
                        <td className="px-4 py-3">
                          {daysLeft !== null ? (
                            <span className={`flex items-center gap-1 text-xs ${daysLeft <= 3 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                              <Clock className="h-3 w-3" />
                              {daysLeft >= 0 ? `${daysLeft}d` : 'Overdue'}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{t.current_phase}/7</td>
                        <td className="px-4 py-3"><StatusBadge status={t.phase_status} /></td>
                        <td className="px-4 py-3"><PaymentBadge state={t.payment_state} /></td>
                        <td className="px-4 py-3">
                          {t.complexity_band ? (
                            <Badge variant="outline" className="text-[10px]">{t.complexity_band}</Badge>
                          ) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
