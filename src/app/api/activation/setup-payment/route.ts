import { apiError, apiOk } from '@/lib/biddesk/responses'
import { requirePortalContext } from '@/lib/biddesk/server'
import { getPaymentAdapter, getDefaultProvider } from '@/lib/payments'
import type { PaymentProvider } from '@/lib/payments'

export async function POST(request: Request) {
  try {
    const { supabase, user, clientId } = await requirePortalContext()
    const body = await request.json().catch(() => ({}))
    const preferredProvider = (body.provider as PaymentProvider) ?? getDefaultProvider()

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, activation_status, setup_fee_amount_cents, contact_email, legal_name')
      .eq('id', clientId)
      .single()

    if (clientError || !client) {
      return apiError('NOT_FOUND', 'Client record not found', 404)
    }

    if (client.activation_status === 'active') {
      return apiError('CONFLICT', 'Setup already completed', 409)
    }

    // Create payment record
    const reference = `setup_${clientId}_${Date.now()}`

    const { data: payment, error: insertError } = await supabase
      .from('setup_payments')
      .insert({
        client_id: clientId,
        profile_id: user.id,
        amount_cents: client.setup_fee_amount_cents,
        currency: 'ZAR',
        status: 'pending',
        payment_provider: preferredProvider,
        provider_payment_id: reference,
      })
      .select('id, amount_cents, currency')
      .single()

    if (insertError || !payment) {
      return apiError('INTERNAL_ERROR', 'Failed to create setup payment', 500)
    }

    // Initialize with the chosen payment provider
    const adapter = getPaymentAdapter(preferredProvider)
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/account?payment=success&ref=${reference}`
    const cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/account?payment=cancelled`

    const result = await adapter.initialize({
      reference,
      amountCents: client.setup_fee_amount_cents,
      currency: 'ZAR',
      email: user.email ?? client.contact_email ?? '',
      name: client.legal_name,
      purpose: 'setup_fee',
      callbackUrl,
      cancelUrl,
      metadata: {
        source: 'setup',
        clientId,
        profileId: user.id,
        setupPaymentId: payment.id,
      },
    })

    // Update with provider payment ID
    await supabase
      .from('setup_payments')
      .update({ provider_payment_id: result.providerPaymentId })
      .eq('id', payment.id)

    return apiOk({
      setupPaymentId: payment.id,
      amountCents: payment.amount_cents,
      currency: payment.currency,
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

    console.error('Setup payment error:', error)
    return apiError('INTERNAL_ERROR', 'Payment initialization failed', 500)
  }
}
