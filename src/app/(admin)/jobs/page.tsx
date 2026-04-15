import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/status-badge'
import { Cpu, Clock, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export default async function AdminJobsPage() {
  const supabase = await createClient()

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, job_type, phase, queue_class, status, priority_score, complexity_band, worker_name, retry_count, last_error, tender_id, client_id, created_at, started_at, completed_at, failed_at, tenders(tender_title), clients(legal_name)')
    .order('created_at', { ascending: false })
    .limit(50)

  // Stats
  const running = jobs?.filter((j) => j.status === 'running').length ?? 0
  const queued = jobs?.filter((j) => j.status === 'queued' || j.status === 'ready').length ?? 0
  const failed = jobs?.filter((j) => j.status === 'failed').length ?? 0
  const completed = jobs?.filter((j) => j.status === 'completed').length ?? 0

  const heavyRunning = jobs?.filter((j) => j.status === 'running' && j.queue_class === 'heavy').length ?? 0
  const mediumRunning = jobs?.filter((j) => j.status === 'running' && j.queue_class === 'medium').length ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Job Queue</h1>
        <p className="text-muted-foreground">Worker job monitoring and diagnostics</p>
      </div>

      {/* Capacity indicators */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <Cpu className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{running}</p>
              <p className="text-xs text-muted-foreground">Running</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{queued}</p>
              <p className="text-xs text-muted-foreground">Queued</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{failed}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{completed}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100">
              <AlertTriangle className="h-5 w-5 text-zinc-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Capacity</p>
              <p className="text-xs text-muted-foreground">
                Heavy: {heavyRunning}/1 &middot; Medium: {mediumRunning}/2
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Jobs table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Jobs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!jobs || jobs.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted-foreground text-center">No jobs</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-6 py-3 font-medium">Job</th>
                    <th className="px-4 py-3 font-medium">Tender</th>
                    <th className="px-4 py-3 font-medium">Client</th>
                    <th className="px-4 py-3 font-medium">Queue</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Worker</th>
                    <th className="px-4 py-3 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {jobs.map((job) => {
                    const tenderTitle = ((Array.isArray(job.tenders) ? job.tenders[0] : job.tenders) as { tender_title: string } | null)?.tender_title ?? '—'
                    const clientName = ((Array.isArray(job.clients) ? job.clients[0] : job.clients) as { legal_name: string } | null)?.legal_name ?? '—'

                    return (
                      <tr key={job.id} className={`hover:bg-muted/50 ${job.status === 'failed' ? 'bg-red-50/30' : ''}`}>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${
                              job.status === 'running' ? 'bg-blue-500 animate-pulse' :
                              job.status === 'completed' ? 'bg-emerald-500' :
                              job.status === 'failed' ? 'bg-red-500' :
                              'bg-zinc-300'
                            }`} />
                            <div>
                              <p className="font-medium">{job.job_type.replace(/_/g, ' ')}</p>
                              <p className="text-xs text-muted-foreground">Phase {job.phase} &middot; P{job.priority_score}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-[150px] truncate">{tenderTitle}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{clientName}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-[10px]">{job.queue_class}</Badge>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{job.worker_name ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{timeAgo(job.created_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Failed jobs detail */}
      {failed > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Failed Jobs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {jobs?.filter((j) => j.status === 'failed').map((job) => (
              <div key={job.id} className="rounded-md border border-red-200 bg-red-50/50 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{job.job_type.replace(/_/g, ' ')} (Phase {job.phase})</p>
                  <span className="text-xs text-muted-foreground">Retries: {job.retry_count}/{2}</span>
                </div>
                {job.last_error && (
                  <p className="mt-1 text-xs text-destructive font-mono break-all">{job.last_error}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
