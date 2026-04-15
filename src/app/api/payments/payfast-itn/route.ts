import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { payfastAdapter } from '@/lib/payments/payfast'

/**
 * PayFast ITN (Instant Transaction Notification) handler.
 * PayFast sends POST with application/x-www-form-urlencoded body.
 * Must respond with 200 OK and empty body.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const validation = await payfastAdapter.validateWebhook(request.headers, body)

    if (!validation.valid) {
      console.error('PayFast ITN: invalid signature')
      return new Response('', { status: 200 }) // PayFast requires 200 even on error
    }

    if (validation.status !== 'success' || !validation.reference) {
      // Acknowledge but don't process non-success
      return new Response('', { status: 200 })
    }

    const supabase = await createServiceClient()
    const metadata = validation.metadata as Record<string, unknown> | undefined
    const purpose = metadata?.purpose as string | undefined

    if (purpose === 'setup_fee') {
      const { error } = await supabase
        .from('setup_payments')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          provider_payment_id: validation.providerPaymentId ?? validation.reference,
        })
        .eq('provider_payment_id', validation.reference)

      if (error) {
        console.error('PayFast ITN: setup payment update failed', error)
      }
    } else {
      const { data: payment, error } = await supabase
        .from('tender_payments')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
        })
        .eq('provider_payment_id', validation.reference)
        .select('id, tender_id')
        .single()

      if (error || !payment) {
        console.error('PayFast ITN: tender payment not found for ref:', validation.reference)
      } else {
        await supabase.rpc('refresh_tender_payment_state', {
          p_tender_id: payment.tender_id,
        })
      }
    }

    // PayFast requires 200 OK with empty body
    return new Response('', { status: 200 })
  } catch (err) {
    console.error('PayFast ITN error:', err)
    return new Response('', { status: 200 })
  }
}
