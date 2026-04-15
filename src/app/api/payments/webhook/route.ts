import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiError, apiOk } from '@/lib/biddesk/responses'

export async function POST(request: NextRequest) {
  try {
    // TODO: Replace with Paystack signature validation
    const signature = request.headers.get('x-paystack-signature')
    if (!signature) {
      return apiError('FORBIDDEN', 'Missing webhook signature', 403)
    }

    const payload = await request.json()
    const supabase = await createServiceClient()

    const event = payload.event as string
    const data = payload.data as Record<string, unknown>
    const reference = data?.reference as string

    if (!reference) {
      return apiError('INVALID_INPUT', 'Payment reference is required', 400)
    }

    const paid = event === 'charge.success'

    // Determine if this is a setup payment or tender payment from metadata
    const metadata = data?.metadata as Record<string, unknown> | undefined
    const source = metadata?.source as 'setup' | 'tender' | undefined

    if (source === 'setup') {
      const { data: row, error } = await supabase
        .from('setup_payments')
        .update({
          status: paid ? 'paid' : 'failed',
          paid_at: paid ? new Date().toISOString() : null,
          provider_payment_id: reference,
        })
        .eq('provider_payment_id', reference)
        .select('id')
        .single()

      if (error || !row) {
        return apiError('NOT_FOUND', 'Setup payment not found', 404)
      }
    } else {
      const { data: payment, error } = await supabase
        .from('tender_payments')
        .update({
          status: paid ? 'paid' : 'failed',
          paid_at: paid ? new Date().toISOString() : null,
        })
        .eq('provider_payment_id', reference)
        .select('id, tender_id')
        .single()

      if (error || !payment) {
        return apiError('NOT_FOUND', 'Tender payment not found', 404)
      }

      if (paid) {
        await supabase.rpc('refresh_tender_payment_state', {
          p_tender_id: payment.tender_id,
        })
      }
    }

    return apiOk({ received: true })
  } catch {
    return apiError('INTERNAL_ERROR', 'Webhook handling failed', 500)
  }
}
