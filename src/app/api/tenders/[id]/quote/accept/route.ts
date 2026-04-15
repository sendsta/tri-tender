import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/biddesk/responses'
import { requirePortalContext } from '@/lib/biddesk/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: tenderId } = await params
    const { supabase, clientId } = await requirePortalContext()
    const body = await request.json()
    const quoteId = body.quoteId as string | undefined
    const rushRequested = Boolean(body.rushRequested)

    if (!quoteId) {
      return apiError('INVALID_INPUT', 'quoteId is required', 400)
    }

    const { data: tender, error: tenderError } = await supabase
      .from('tenders')
      .select('id, client_id')
      .eq('id', tenderId)
      .eq('client_id', clientId)
      .single()

    if (tenderError || !tender) {
      return apiError('NOT_FOUND', 'Tender not found', 404)
    }

    const { data: quote, error: quoteError } = await supabase
      .from('tender_quotes')
      .select('id, status, valid_until, rush_available')
      .eq('id', quoteId)
      .eq('tender_id', tenderId)
      .eq('client_id', clientId)
      .single()

    if (quoteError || !quote) {
      return apiError('NOT_FOUND', 'Quote not found', 404)
    }

    if (quote.valid_until && new Date(quote.valid_until).getTime() < Date.now()) {
      return apiError('QUOTE_EXPIRED', 'Quote has expired', 409)
    }

    await supabase
      .from('tender_quotes')
      .update({ status: 'superseded' })
      .eq('tender_id', tenderId)
      .neq('id', quoteId)
      .in('status', ['draft', 'presented', 'accepted'])

    const { error: acceptError } = await supabase
      .from('tender_quotes')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', quoteId)

    if (acceptError) {
      return apiError('INTERNAL_ERROR', 'Failed to accept quote', 500)
    }

    await supabase
      .from('tenders')
      .update({
        latest_quote_id: quoteId,
        quote_status: 'accepted',
        rush_requested: rushRequested,
      })
      .eq('id', tenderId)

    await supabase.rpc('refresh_tender_payment_state', {
      p_tender_id: tenderId,
    })

    const { data: updatedTender, error: updatedTenderError } = await supabase
      .from('tenders')
      .select('payment_gate, payment_state')
      .eq('id', tenderId)
      .single()

    if (updatedTenderError || !updatedTender) {
      return apiError('INTERNAL_ERROR', 'Failed to refresh tender state', 500)
    }

    return apiOk({
      tenderId,
      quoteId,
      quoteStatus: 'accepted',
      paymentGate: updatedTender.payment_gate,
      paymentState: updatedTender.payment_state,
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
