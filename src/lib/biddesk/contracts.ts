export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INVALID_INPUT'
  | 'SETUP_REQUIRED'
  | 'QUOTE_REQUIRED'
  | 'QUOTE_EXPIRED'
  | 'PAYMENT_REQUIRED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UPLOAD_FAILED'
  | 'INTERNAL_ERROR'

export type ApiSuccess<T> = {
  ok: true
  data: T
}

export type ApiFailure = {
  ok: false
  error: {
    code: ApiErrorCode
    message: string
  }
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure

export type SetupPaymentResponse = ApiResponse<{
  setupPaymentId: string
  amountCents: number
  currency: string
  checkoutUrl: string
}>

export type UploadTenderResponse = ApiResponse<{
  tenderId: string
  jobId: string
  status: string
  paymentGate: string
}>

export type AcceptQuoteResponse = ApiResponse<{
  tenderId: string
  quoteId: string
  quoteStatus: string
  paymentGate: string
  paymentState: string
}>

export type ProceedTenderResponse = ApiResponse<{
  tenderId: string
  jobId: string
  nextPhase: number
  status: string
}>

// Client-visible tender phases
export const TENDER_PHASES = [
  { phase: 1, label: 'Tender Received' },
  { phase: 2, label: 'Intake & Classification' },
  { phase: 3, label: 'Requirements & Compliance' },
  { phase: 4, label: 'Drafting in Progress' },
  { phase: 5, label: 'Evidence & Appendices' },
  { phase: 6, label: 'QA & Final Checks' },
  { phase: 7, label: 'Submission Pack Ready' },
] as const

export type TenderPhase = (typeof TENDER_PHASES)[number]['phase']

// Status badge mapping
export const STATUS_CONFIG = {
  queued: { label: 'Queued', variant: 'secondary' as const },
  preflight: { label: 'Preflight', variant: 'secondary' as const },
  awaiting_payment: { label: 'Awaiting Payment', variant: 'outline' as const },
  running: { label: 'In Progress', variant: 'default' as const },
  blocked: { label: 'Blocked', variant: 'destructive' as const },
  completed: { label: 'Ready', variant: 'default' as const },
  failed: { label: 'Failed', variant: 'destructive' as const },
} as const
