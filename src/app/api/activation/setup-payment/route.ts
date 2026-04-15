import { apiError, apiOk } from '@/lib/biddesk/responses'
import { requirePortalContext } from '@/lib/biddesk/server'

export async function POST(request: Request) {
  try {
    const { supabase, user, clientId } = await requirePortalContext()
    const body = await request.json().catch(() => ({}))
    const returnUrl = body.returnUrl as string | undefined

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, activation_status, setup_fee_amount_cents')
      .eq('id', clientId)
      .single()

    if (clientError || !client) {
      return apiError('NOT_FOUND', 'Client record not found', 404)
    }

    if (client.activation_status === 'active') {
      return apiError('CONFLICT', 'Setup already completed', 409)
    }

    const { data: payment, error: insertError } = await supabase
      .from('setup_payments')
      .insert({
        client_id: clientId,
        profile_id: user.id,
        amount_cents: client.setup_fee_amount_cents,
        currency: 'ZAR',
        status: 'pending',
        payment_provider: 'paystack',
      })
      .select('id, amount_cents, currency')
      .single()

    if (insertError || !payment) {
      return apiError('INTERNAL_ERROR', 'Failed to create setup payment', 500)
    }

    // TODO: Create Paystack transaction and return real checkout URL
    const checkoutUrl =
      returnUrl ??
      `${process.env.NEXT_PUBLIC_APP_URL}/account/activation?setupPaymentId=${payment.id}`

    return apiOk({
      setupPaymentId: payment.id,
      amountCents: payment.amount_cents,
      currency: payment.currency,
      checkoutUrl,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return apiError('UNAUTHORIZED', 'Authentication required', 401)
    }

    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return apiError('FORBIDDEN', 'Client membership required', 403)
    }

    return apiError('INTERNAL_ERROR', 'Unexpected error', 500)
  }
}
