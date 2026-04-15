import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TENDER_PHASES } from '@/lib/biddesk/contracts'
import { StatusBadge, PaymentBadge } from '@/components/status-badge'
import { PaymentButton } from '@/components/payment-button'
import { DownloadButton } from '@/components/download-button'
import {
  FileText,
  AlertTriangle,
  Download,
  CheckCircle2,
  Circle,
  Clock,
  Receipt,
  Activity,
  Zap,
} from 'lucide-react'

function formatCents(cents: number, currency = 'ZAR') {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(cents / 100)
}

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export default async function TenderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: membership } = await supabase
    .from('client_memberships')
    .select('client_id')
    .eq('profile_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membership) return notFound()

  const { data: tender } = await supabase
    .from('tenders')
    .select(
      'id, tender_title, buyer, deadline, complexity_band, current_phase, phase_status, payment_state, payment_gate, quote_status, latest_quote_id, deposit_required, rush_requested, rush_confirmed, created_at',
    )
    .eq('id', id)
    .eq('client_id', membership.client_id)
    .single()

  if (!tender) return notFound()

  // Fetch all related data in parallel
  const [
    { data: quote },
    { data: missingItems },
    { data: files },
    { data: jobs },
    { data: jobEvents },
  ] = await Promise.all([
    tender.latest_quote_id
      ? supabase
          .from('tender_quotes')
          .select('id, status, price_cents, deposit_required, deposit_cents, balance_cents, rush_available, rush_fee_cents, turnaround_summary, valid_until, complexity_band')
          .eq('id', tender.latest_quote_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('missing_items')
      .select('id, description, criticality, resolved')
      .eq('tender_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('tender_files')
      .select('id, file_type, filename, storage_path, storage_bucket, created_at')
      .eq('tender_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('jobs')
      .select('id, job_type, phase, status, queue_class, created_at, started_at, completed_at')
      .eq('tender_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('job_events')
      .select('id, event_type, message, created_at')
      .eq('tender_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const inputFiles = files?.filter((f) => f.file_type === 'input') ?? []
  const outputFiles = files?.filter((f) => f.file_type === 'output' || f.file_type === 'final') ?? []
  const openMissing = missingItems?.filter((m) => !m.resolved) ?? []
  const resolvedMissing = missingItems?.filter((m) => m.resolved) ?? []

  // Deadline countdown
  let daysLeft: number | null = null
  let deadlineUrgent = false
  if (tender.deadline) {
    daysLeft = Math.ceil((new Date(tender.deadline).getTime() - Date.now()) / 86400000)
    deadlineUrgent = daysLeft <= 3
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight">{tender.tender_title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {tender.buyer && tender.buyer !== 'TBD' && <span>{tender.buyer}</span>}
            {tender.deadline && (
              <>
                {tender.buyer && tender.buyer !== 'TBD' && <span>&middot;</span>}
                <span className={`flex items-center gap-1 ${deadlineUrgent ? 'text-destructive font-medium' : ''}`}>
                  <Clock className="h-3 w-3" />
                  {daysLeft !== null && daysLeft >= 0
                    ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`
                    : daysLeft !== null
                      ? 'Overdue'
                      : `Due ${new Date(tender.deadline).toLocaleDateString()}`}
                </span>
              </>
            )}
            {tender.complexity_band && (
              <>
                <span>&middot;</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{tender.complexity_band}</Badge>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PaymentBadge state={tender.payment_state} />
          <StatusBadge status={tender.phase_status} />
        </div>
      </div>

      {/* Phase Tracker */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-0">
            {TENDER_PHASES.map((phase, idx) => {
              const isActive = phase.phase === tender.current_phase
              const isDone = phase.phase < tender.current_phase
              return (
                <div key={phase.phase} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1">
                    {isDone ? (
                      <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                    ) : isActive ? (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-primary bg-primary">
                        <div className="h-2.5 w-2.5 rounded-full bg-primary-foreground" />
                      </div>
                    ) : (
                      <Circle className="h-6 w-6 text-muted-foreground/25" />
                    )}
                    <span className={`text-[10px] text-center max-w-[80px] leading-tight ${
                      isActive ? 'font-semibold text-foreground' : isDone ? 'text-muted-foreground' : 'text-muted-foreground/40'
                    }`}>
                      {phase.label}
                    </span>
                  </div>
                  {idx < TENDER_PHASES.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-1 mt-[-16px] ${isDone ? 'bg-emerald-500' : 'bg-muted-foreground/15'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Quote & Payment Card */}
      {(quote || tender.payment_gate !== 'none') && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Quote & Payment</CardTitle>
              </div>
              <PaymentBadge state={tender.payment_state} />
            </div>
          </CardHeader>
          <CardContent>
            {quote ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-lg font-bold">{formatCents(quote.price_cents)}</p>
                  </div>
                  {quote.deposit_required && (
                    <>
                      <div>
                        <p className="text-xs text-muted-foreground">Deposit</p>
                        <p className="text-lg font-semibold">{formatCents(quote.deposit_cents ?? 0)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Balance</p>
                        <p className="text-lg font-semibold">{formatCents(quote.balance_cents ?? 0)}</p>
                      </div>
                    </>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">Complexity</p>
                    <p className="text-lg font-semibold">{quote.complexity_band}</p>
                  </div>
                </div>

                {quote.turnaround_summary && (
                  <p className="text-sm text-muted-foreground">
                    <Clock className="inline h-3 w-3 mr-1" />
                    {quote.turnaround_summary}
                  </p>
                )}

                {quote.rush_available && !tender.rush_requested && (
                  <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                    <Zap className="h-4 w-4 text-amber-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-800">Rush processing available</p>
                      <p className="text-xs text-amber-600">
                        +{formatCents(quote.rush_fee_cents ?? 0)} for priority processing
                      </p>
                    </div>
                  </div>
                )}

                {tender.rush_confirmed && (
                  <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3">
                    <Zap className="h-4 w-4 text-emerald-600" />
                    <p className="text-sm font-medium text-emerald-800">Rush processing confirmed</p>
                  </div>
                )}

                {quote.valid_until && (
                  <p className="text-xs text-muted-foreground">
                    Quote valid until {new Date(quote.valid_until).toLocaleDateString()}
                  </p>
                )}

                {tender.payment_gate !== 'none' && tender.payment_state !== 'paid' && (
                  <div className="pt-2">
                    <PaymentButton
                      endpoint={`/api/tenders/${tender.id}/pay`}
                      amountCents={
                        tender.payment_gate === 'full_payment_required'
                          ? quote.price_cents
                          : tender.payment_gate === 'deposit_required'
                            ? (quote.deposit_cents ?? Math.round(quote.price_cents * 0.5))
                            : tender.payment_gate === 'balance_required'
                              ? (quote.balance_cents ?? Math.round(quote.price_cents * 0.5))
                              : quote.price_cents
                      }
                      label={
                        tender.payment_gate === 'full_payment_required'
                          ? `Pay ${formatCents(quote.price_cents)}`
                          : tender.payment_gate === 'deposit_required'
                            ? `Pay Deposit ${formatCents(quote.deposit_cents ?? 0)}`
                            : tender.payment_gate === 'balance_required'
                              ? `Pay Balance ${formatCents(quote.balance_cents ?? 0)}`
                              : 'Make Payment'
                      }
                      bodyParams={{
                        paymentKind: tender.payment_gate === 'full_payment_required'
                          ? 'tender_full'
                          : tender.payment_gate === 'deposit_required'
                            ? 'tender_deposit'
                            : 'tender_balance',
                      }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-4">
                <Receipt className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  {tender.payment_gate === 'quote_acceptance_required'
                    ? 'A quote will be generated after preflight analysis'
                    : tender.payment_gate === 'setup_required'
                      ? 'Account activation required before processing'
                      : 'No quote available yet'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabbed Content: Missing Items | Files | Activity */}
      <Tabs defaultValue="missing" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="missing" className="gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Missing Items
            {openMissing.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">
                {openMissing.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="files" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Files
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            Activity
          </TabsTrigger>
        </TabsList>

        {/* Missing Items Tab */}
        <TabsContent value="missing">
          <Card>
            <CardContent className="pt-6">
              {openMissing.length === 0 && resolvedMissing.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500/40" />
                  <p className="text-sm text-muted-foreground">No items to track</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {openMissing.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Outstanding ({openMissing.length})
                      </p>
                      {openMissing.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between rounded-md border p-3"
                        >
                          <div className="flex items-center gap-2.5">
                            <AlertTriangle
                              className={`h-4 w-4 shrink-0 ${
                                item.criticality === 'CRITICAL'
                                  ? 'text-destructive'
                                  : item.criticality === 'HIGH'
                                    ? 'text-amber-500'
                                    : 'text-muted-foreground'
                              }`}
                            />
                            <span className="text-sm">{item.description}</span>
                          </div>
                          <Badge
                            variant={item.criticality === 'CRITICAL' ? 'destructive' : 'outline'}
                            className="shrink-0"
                          >
                            {item.criticality}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  {resolvedMissing.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Resolved ({resolvedMissing.length})
                      </p>
                      {resolvedMissing.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2.5 rounded-md p-3 opacity-60"
                        >
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                          <span className="text-sm line-through">{item.description}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files">
          <Card>
            <CardContent className="pt-6 space-y-4">
              {inputFiles.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Uploaded Documents
                  </p>
                  <div className="space-y-1">
                    {inputFiles.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between rounded-md border p-3"
                      >
                        <div className="flex items-center gap-2.5">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{f.filename}</p>
                            <p className="text-xs text-muted-foreground">
                              Uploaded {new Date(f.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {outputFiles.length > 0 && (
                <div>
                  {inputFiles.length > 0 && <Separator className="my-3" />}
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Generated Outputs
                  </p>
                  <div className="space-y-1">
                    {outputFiles.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50/50 p-3"
                      >
                        <div className="flex items-center gap-2.5">
                          <FileText className="h-4 w-4 text-emerald-600" />
                          <div>
                            <p className="text-sm font-medium">{f.filename}</p>
                            <p className="text-xs text-muted-foreground">
                              Generated {new Date(f.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <DownloadButton fileId={f.id} filename={f.filename} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {inputFiles.length === 0 && outputFiles.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-6">
                  <FileText className="h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No files yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <Card>
            <CardContent className="pt-6">
              {(!jobEvents || jobEvents.length === 0) && (!jobs || jobs.length === 0) ? (
                <div className="flex flex-col items-center gap-2 py-6">
                  <Activity className="h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No activity yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Jobs summary */}
                  {jobs && jobs.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Jobs
                      </p>
                      {jobs.map((job) => (
                        <div
                          key={job.id}
                          className="flex items-center justify-between rounded-md border p-3"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`h-2 w-2 rounded-full ${
                              job.status === 'completed' ? 'bg-emerald-500' :
                              job.status === 'running' ? 'bg-blue-500 animate-pulse' :
                              job.status === 'failed' ? 'bg-red-500' :
                              'bg-zinc-300'
                            }`} />
                            <div>
                              <p className="text-sm font-medium">{job.job_type.replace(/_/g, ' ')}</p>
                              <p className="text-xs text-muted-foreground">
                                Phase {job.phase} &middot; {job.queue_class}
                              </p>
                            </div>
                          </div>
                          <StatusBadge status={job.status} />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Event timeline */}
                  {jobEvents && jobEvents.length > 0 && (
                    <div className="space-y-2">
                      {jobs && jobs.length > 0 && <Separator className="my-3" />}
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Event Log
                      </p>
                      <div className="space-y-0">
                        {jobEvents.map((event, idx) => (
                          <div
                            key={event.id}
                            className="flex gap-3 py-2"
                          >
                            <div className="flex flex-col items-center">
                              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 mt-1.5" />
                              {idx < jobEvents.length - 1 && (
                                <div className="h-full w-px bg-muted-foreground/15 mt-1" />
                              )}
                            </div>
                            <div className="flex-1 pb-2">
                              <p className="text-sm">{event.message}</p>
                              <p className="text-xs text-muted-foreground">{timeAgo(event.created_at)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
