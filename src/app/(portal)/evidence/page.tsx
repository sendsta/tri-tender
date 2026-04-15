import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FolderOpen, CheckCircle2, AlertTriangle, Clock } from 'lucide-react'

export default async function EvidencePage() {
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

  const { data: documents } = membership?.client_id
    ? await supabase
        .from('documents')
        .select('id, doc_name, category, status, expiry_date, created_at')
        .eq('client_id', membership.client_id)
        .order('doc_name', { ascending: true })
    : { data: [] }

  const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    present: { icon: CheckCircle2, color: 'text-emerald-500', variant: 'default' },
    ready: { icon: CheckCircle2, color: 'text-emerald-500', variant: 'default' },
    missing: { icon: AlertTriangle, color: 'text-destructive', variant: 'destructive' },
    stale: { icon: Clock, color: 'text-amber-500', variant: 'outline' },
    'needs review': { icon: Clock, color: 'text-amber-500', variant: 'outline' },
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Evidence Library</h1>
        <p className="text-muted-foreground">
          Company documents and certifications used across tenders
        </p>
      </div>

      {!documents || documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <FolderOpen className="h-12 w-12 text-muted-foreground/40" />
            <h3 className="font-semibold">No evidence records yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Documents will appear here as your tender responses are processed.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documents</CardTitle>
            <CardDescription>
              {documents.length} document{documents.length !== 1 ? 's' : ''} in your evidence library
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {documents.map((doc) => {
                const cfg = statusConfig[doc.status] ?? statusConfig['needs review']
                const Icon = cfg.icon
                const isExpired = doc.expiry_date && new Date(doc.expiry_date) < new Date()

                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between px-6 py-4"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`h-4 w-4 ${cfg.color}`} />
                      <div>
                        <p className="text-sm font-medium">{doc.doc_name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {doc.category && <span>{doc.category}</span>}
                          {doc.expiry_date && (
                            <>
                              <span>&middot;</span>
                              <span className={isExpired ? 'text-destructive' : ''}>
                                {isExpired ? 'Expired' : 'Expires'}{' '}
                                {new Date(doc.expiry_date).toLocaleDateString()}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <Badge variant={isExpired ? 'destructive' : cfg.variant}>
                      {isExpired ? 'Expired' : doc.status}
                    </Badge>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
