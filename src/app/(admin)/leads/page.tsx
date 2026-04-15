import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Mail, Phone, Building2 } from 'lucide-react'

const statusColors: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700 border-blue-200',
  contacted: 'bg-amber-50 text-amber-700 border-amber-200',
  qualified: 'bg-purple-50 text-purple-700 border-purple-200',
  converted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  lost: 'bg-zinc-100 text-zinc-500 border-zinc-200',
}

export default async function AdminLeadsPage() {
  const supabase = await createClient()

  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })

  const newCount = leads?.filter((l) => l.status === 'new').length ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground">Enquiries from the landing page and other sources</p>
        </div>
        {newCount > 0 && (
          <Badge variant="destructive">{newCount} new</Badge>
        )}
      </div>

      {!leads || leads.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Users className="h-12 w-12 text-muted-foreground/40" />
            <h3 className="font-semibold">No leads yet</h3>
            <p className="text-sm text-muted-foreground">Leads will appear here when visitors submit the contact form.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{leads.length} lead{leads.length !== 1 ? 's' : ''}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {leads.map((lead) => (
                <div key={lead.id} className="flex items-start justify-between px-6 py-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium">{lead.company_name}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{lead.contact_name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {lead.email}
                      </span>
                      {lead.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {lead.phone}
                        </span>
                      )}
                    </div>
                    {lead.message && (
                      <p className="text-xs text-muted-foreground mt-1 max-w-lg truncate">{lead.message}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusColors[lead.status] ?? ''}`}>
                      {lead.status}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
