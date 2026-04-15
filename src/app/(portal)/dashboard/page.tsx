import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/status-badge'
import { FileText, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Get membership
  const { data: membership } = await supabase
    .from('client_memberships')
    .select('client_id')
    .eq('profile_id', user.id)
    .limit(1)
    .maybeSingle()

  const clientId = membership?.client_id

  // Fetch stats in parallel
  const [tendersResult, missingResult] = await Promise.all([
    clientId
      ? supabase
          .from('tenders')
          .select('id, tender_title, buyer, deadline, phase_status, current_phase')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
    clientId
      ? supabase
          .from('missing_items')
          .select('id, description, criticality, resolved, tender_id')
          .eq('resolved', false)
          .limit(20)
      : Promise.resolve({ data: [] }),
  ])

  const tenders = tendersResult.data ?? []
  const missingItems = missingResult.data ?? []

  const activeTenders = tenders.filter(
    (t) => t.phase_status !== 'completed' && t.phase_status !== 'failed',
  )
  const completedTenders = tenders.filter((t) => t.phase_status === 'completed')
  const blockedTenders = tenders.filter((t) => t.phase_status === 'blocked')
  const criticalMissing = missingItems.filter((m) => m.criticality === 'CRITICAL')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your tender operations
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tenders</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeTenders.length}</div>
            <p className="text-xs text-muted-foreground">
              Currently in progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Deadlines</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tenders.filter((t) => t.deadline && new Date(t.deadline) > new Date()).length}
            </div>
            <p className="text-xs text-muted-foreground">
              With future deadlines
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blocked</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{blockedTenders.length}</div>
            <p className="text-xs text-muted-foreground">
              {criticalMissing.length} critical items outstanding
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedTenders.length}</div>
            <p className="text-xs text-muted-foreground">
              Ready for submission
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Tenders */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Tenders</CardTitle>
          <CardDescription>Your latest tender submissions</CardDescription>
        </CardHeader>
        <CardContent>
          {tenders.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No tenders yet</p>
              <Link href="/tenders/new">
                <Badge variant="outline" className="cursor-pointer hover:bg-muted">
                  Upload your first tender
                </Badge>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {tenders.slice(0, 5).map((tender) => (
                <Link
                  key={tender.id}
                  href={`/tenders/${tender.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {tender.tender_title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tender.buyer ?? 'Buyer TBD'}
                      {tender.deadline &&
                        ` \u00b7 Due ${new Date(tender.deadline).toLocaleDateString()}`}
                    </p>
                  </div>
                  <StatusBadge status={tender.phase_status} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Missing Items */}
      {missingItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Outstanding Items</CardTitle>
            <CardDescription>
              Items requiring your attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {missingItems.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle
                      className={`h-4 w-4 ${
                        item.criticality === 'CRITICAL'
                          ? 'text-destructive'
                          : 'text-amber-500'
                      }`}
                    />
                    <span className="text-sm">{item.description}</span>
                  </div>
                  <Badge
                    variant={item.criticality === 'CRITICAL' ? 'destructive' : 'outline'}
                  >
                    {item.criticality}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

