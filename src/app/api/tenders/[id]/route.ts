import { apiError, apiOk } from '@/lib/biddesk/responses'
import { requirePortalContext } from '@/lib/biddesk/server'

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: tenderId } = await params
    const { supabase, clientId } = await requirePortalContext()

    const { data: tender, error: tenderError } = await supabase
      .from('tenders')
      .select(
        `
          id,
          title,
          buyer,
          deadline,
          complexity_band,
          current_phase,
          phase_status,
          payment_state,
          payment_gate,
          quote_status,
          latest_quote_id
        `,
      )
      .eq('id', tenderId)
      .eq('client_id', clientId)
      .single()

    if (tenderError || !tender) {
      return apiError('NOT_FOUND', 'Tender not found', 404)
    }

    const [{ data: quote }, { data: missingItems }, { data: files }] = await Promise.all([
      tender.latest_quote_id
        ? supabase
            .from('tender_quotes')
            .select('id, status, price_cents, deposit_required, deposit_cents, balance_cents')
            .eq('id', tender.latest_quote_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('missing_items')
        .select('id, title, severity, status, due_at')
        .eq('tender_id', tenderId)
        .order('created_at', { ascending: false }),
      supabase
        .from('tender_files')
        .select('id, file_type, filename, storage_path, created_at')
        .eq('tender_id', tenderId)
        .order('created_at', { ascending: false }),
    ])

    return apiOk({
      tenderId: tender.id,
      title: tender.title,
      buyer: tender.buyer,
      deadline: tender.deadline,
      complexityBand: tender.complexity_band,
      currentPhase: tender.current_phase,
      phaseStatus: tender.phase_status,
      paymentState: tender.payment_state,
      paymentGate: tender.payment_gate,
      quoteStatus: tender.quote_status,
      quote: quote
        ? {
            id: quote.id,
            status: quote.status,
            priceCents: quote.price_cents,
            depositRequired: quote.deposit_required,
            depositCents: quote.deposit_cents,
            balanceCents: quote.balance_cents,
          }
        : null,
      missingItems: missingItems ?? [],
      files: files ?? [],
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
