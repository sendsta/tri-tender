import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Shield, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { UploadForm } from '@/components/upload-form'

export default async function NewTenderPage() {
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

  let isActivated = false
  if (membership?.client_id) {
    const { data: client } = await supabase
      .from('clients')
      .select('activation_status')
      .eq('id', membership.client_id)
      .single()
    isActivated = client?.activation_status === 'active'
  }

  if (!isActivated) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Upload New Tender</h1>
          <p className="text-muted-foreground">
            Account activation required before uploading tenders.
          </p>
        </div>

        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
              <Shield className="h-8 w-8 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold">Account Not Yet Activated</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              A one-time setup fee is required before you can submit tenders.
              This amount is credited against your first tender — it is not an additional charge.
            </p>
            <Link href="/account">
              <Button>
                <AlertTriangle className="mr-2 h-4 w-4" />
                Go to Account to Activate
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <UploadForm />
}
