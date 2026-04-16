import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiError, apiOk } from '@/lib/biddesk/responses'
import { paystackAdapter } from '@/lib/payments/paystack'
import { sendActivationConfirmed, sendPaymentConfirmed } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const validation = await paystackAdapter.validateWebhook(request.headers, body)

    if (!validation.valid) {
      return apiError('FORBIDDEN', 'Invalid webhook signature', 403)
    }

    if (validation.status !== 'success' || !validation.reference) {
      return apiOk({ received: true })
    }

    const supabase = await createServiceClient()
    const metadata = validation.metadata as Record<string, unknown> | undefined
    const source = metadata?.source as string | undefined
    const purpose = metadata?.purpose as string | undefined

    if (source === 'setup' || purpose === 'setup_fee') {
      const { data: row, error } = await supabase
        .from('setup_payments')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('provider_payment_id', validation.reference)
        .select('id, client_id, profile_id')
        .single()

      if (error || !row) {
        console.error('Setup payment not found for ref:', validation.reference)
        return apiError('NOT_FOUND', 'Setup payment not found', 404)
      }

      // Send activation email
      const { data: client } = await supabase
        .from('clients')
        .select('legal_name, contact_email')
        .eq('id', row.client_id)
        .single()
      if (client?.contact_email) {
        await sendActivationConfirmed(client.contact_email, client.legal_name)
      }
    } else {
      const { data: payment, error } = await supabase
        .from('tender_payments')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('provider_payment_id', validation.reference)
        .select('id, tender_id, amount_cents, client_id')
        .single()

      if (error || !payment) {
        console.error('Tender payment not found for ref:', validation.reference)
        return apiError('NOT_FOUND', 'Tender payment not found', 404)
      }

      await supabase.rpc('refresh_tender_payment_state', {
        p_tender_id: payment.tender_id,
      })

      // Send payment confirmation email
      const { data: tender } = await supabase
        .from('tenders')
        .select('tender_title')
        .eq('id', payment.tender_id)
        .single()
      const { data: client } = await supabase
        .from('clients')
        .select('contact_email')
        .eq('id', payment.client_id)
        .single()
      if (client?.contact_email && tender) {
        await sendPaymentConfirmed(client.contact_email, tender.tender_title ?? 'Tender', payment.amount_cents)
      }
    }

    return apiOk({ received: true })
  } catch (err) {
    console.error('Paystack webhook error:', err)
    return apiError('INTERNAL_ERROR', 'Webhook handling failed', 500)
  }
}
