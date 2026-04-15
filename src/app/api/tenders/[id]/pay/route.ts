import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/biddesk/responses'
import { requirePortalContext } from '@/lib/biddesk/server'
import { getPaymentAdapter, getDefaultProvider } from '@/lib/payments'
import type { PaymentProvider, PaymentPurpose } from '@/lib/payments'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: tenderId } = await params
    const { supabase, user, clientId } = await requirePortalContext()
    const body = await request.json()
    const preferredProvider = (body.provider as PaymentProvider) ?? getDefaultProvider()
    const paymentKind = (body.paymentKind as PaymentPurpose) ?? 'tender_full'

    // Get tender and its latest quote
    const { data: tender, error: tenderError } = await supabase
      .from('tenders')
      .select('id, tender_title, payment_gate, latest_quote_id, client_id')
      .eq('id', tenderId)
      .eq('client_id', clientId)
      .single()

    if (tenderError || !tender) {
      return apiError('NOT_FOUND', 'Tender not found', 404)
    }

    // Get the accepted quote to determine amount
    if (!tender.latest_quote_id) {
      return apiError('QUOTE_REQUIRED', 'No quote available for this tender', 400)
    }

    const { data: quote } = await supabase
      .from('tender_quotes')
      .select('id, price_cents, deposit_required, deposit_cents, balance_cents, rush_fee_cents, status')
      .eq('id', tender.latest_quote_id)
      .single()

    if (!quote || quote.status !== 'accepted') {
      return apiError('QUOTE_REQUIRED', 'Accepted quote required before payment', 400)
    }

    // Determine amount based on payment kind
    let amountCents: number
    switch (paymentKind) {
      case 'tender_full':
        amountCents = quote.price_cents
        break
      case 'tender_deposit':
        amountCents = quote.deposit_cents ?? Math.round(quote.price_cents * 0.5)
        break
      case 'tender_balance':
        amountCents = quote.balance_cents ?? Math.round(quote.price_cents * 0.5)
        break
      case 'rush_upgrade':
        amountCents = quote.rush_fee_cents ?? 0
        break
      default:
        return apiError('INVALID_INPUT', 'Invalid payment kind', 400)
    }

    if (amountCents <= 0) {
      return apiError('INVALID_INPUT', 'Payment amount must be positive', 400)
    }

    const reference = `tender_${tenderId}_${paymentKind}_${Date.now()}`

    // Create tender_payments record
    const { data: payment, error: paymentError } = await supabase
      .from('tender_payments')
      .insert({
        tender_id: tenderId,
        client_id: clientId,
        tender_quote_id: quote.id,
        payment_kind: paymentKind,
        payment_provider: preferredProvider,
        provider_payment_id: reference,
        amount_cents: amountCents,
        currency: 'ZAR',
        status: 'pending',
        created_by: user.id,
      })
      .select('id')
      .single()

    if (paymentError || !payment) {
      return apiError('INTERNAL_ERROR', 'Failed to create payment record', 500)
    }

    // Initialize with payment provider
    const adapter = getPaymentAdapter(preferredProvider)
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/tenders/${tenderId}?payment=success&ref=${reference}`
    const cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/tenders/${tenderId}?payment=cancelled`

    const result = await adapter.initialize({
      reference,
      amountCents,
      currency: 'ZAR',
      email: user.email ?? '',
      purpose: paymentKind,
      callbackUrl,
      cancelUrl,
      metadata: {
        source: 'tender',
        tenderId,
        clientId,
        paymentId: payment.id,
        quoteId: quote.id,
        paymentKind,
      },
    })

    // Update with provider payment ID
    await supabase
      .from('tender_payments')
      .update({ provider_payment_id: result.providerPaymentId })
      .eq('id', payment.id)

    return apiOk({
      paymentId: payment.id,
      amountCents,
      currency: 'ZAR',
      checkoutUrl: result.checkoutUrl,
      provider: preferredProvider,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return apiError('UNAUTHORIZED', 'Authentication required', 401)
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return apiError('FORBIDDEN', 'Client membership required', 403)
    }
    console.error('Tender payment error:', error)
    return apiError('INTERNAL_ERROR', 'Payment initialization failed', 500)
  }
}
