/**
 * Payment provider abstraction for Tri-Tender.
 * Supports Paystack and PayFast with a unified interface.
 */

export type PaymentProvider = 'paystack' | 'payfast'

export type PaymentPurpose = 'setup_fee' | 'tender_full' | 'tender_deposit' | 'tender_balance' | 'rush_upgrade'

export interface InitializePaymentInput {
  /** Unique reference for this payment */
  reference: string
  /** Amount in cents (ZAR) */
  amountCents: number
  /** Currency code */
  currency: string
  /** Customer email */
  email: string
  /** Customer name */
  name?: string
  /** What this payment is for */
  purpose: PaymentPurpose
  /** URL to redirect after successful payment */
  callbackUrl: string
  /** URL to redirect if payment is cancelled */
  cancelUrl?: string
  /** Metadata to attach to the payment */
  metadata?: Record<string, unknown>
}

export interface InitializePaymentResult {
  provider: PaymentProvider
  /** Provider's unique payment/transaction ID */
  providerPaymentId: string
  /** URL to redirect the user to for payment */
  checkoutUrl: string
  /** Access code (Paystack-specific) */
  accessCode?: string
}

export interface VerifyPaymentResult {
  provider: PaymentProvider
  providerPaymentId: string
  reference: string
  status: 'success' | 'failed' | 'pending'
  amountCents: number
  currency: string
  paidAt?: string
  metadata?: Record<string, unknown>
}

export interface WebhookValidationResult {
  valid: boolean
  provider: PaymentProvider
  event: string
  reference?: string
  providerPaymentId?: string
  status?: 'success' | 'failed' | 'pending'
  amountCents?: number
  metadata?: Record<string, unknown>
}

export interface PaymentProviderAdapter {
  provider: PaymentProvider
  initialize(input: InitializePaymentInput): Promise<InitializePaymentResult>
  verify(reference: string): Promise<VerifyPaymentResult>
  validateWebhook(headers: Headers, body: string): Promise<WebhookValidationResult>
}
