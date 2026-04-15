import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { FileText, Plus } from 'lucide-react'
import Link from 'next/link'

export default async function TendersPage() {
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

  const { data: tenders } = membership?.client_id
    ? await supabase
        .from('tenders')
        .select('id, tender_title, buyer, deadline, phase_status, current_phase, complexity_band, created_at')
        .eq('client_id', membership.client_id)
        .order('created_at', { ascending: false })
    : { data: [] }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tenders</h1>
          <p className="text-muted-foreground">
            All tender submissions for your company
          </p>
        </div>
        <Link href="/tenders/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Tender
          </Button>
        </Link>
      </div>

      {!tenders || tenders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <FileText className="h-12 w-12 text-muted-foreground/40" />
            <h3 className="font-semibold">No tenders yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Upload your first tender document to get started. We will handle
              the intake, classification, and response drafting.
            </p>
            <Link href="/tenders/new">
              <Button variant="outline">Upload Tender</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tenders.length} tender{tenders.length !== 1 ? 's' : ''}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {tenders.map((tender) => (
                <Link
                  key={tender.id}
                  href={`/tenders/${tender.id}`}
                  className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-muted/50"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{tender.tender_title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {tender.buyer && <span>{tender.buyer}</span>}
                      {tender.deadline && (
                        <>
                          <span>&middot;</span>
                          <span>Due {new Date(tender.deadline).toLocaleDateString()}</span>
                        </>
                      )}
                      {tender.complexity_band && (
                        <>
                          <span>&middot;</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {tender.complexity_band}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={tender.phase_status} />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

