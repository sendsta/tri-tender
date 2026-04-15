import crypto from 'crypto'
import type {
  PaymentProviderAdapter,
  InitializePaymentInput,
  InitializePaymentResult,
  VerifyPaymentResult,
  WebhookValidationResult,
} from './types'

// PayFast uses form POST redirect, not an API call to initialize.
// We build the form data + signature, return the redirect URL with params.

const PAYFAST_SANDBOX_URL = 'https://sandbox.payfast.co.za/eng/process'
const PAYFAST_LIVE_URL = 'https://www.payfast.co.za/eng/process'

function getConfig() {
  const merchantId = process.env.PAYFAST_MERCHANT_ID
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY
  const passphrase = process.env.PAYFAST_PASSPHRASE ?? ''
  const mode = process.env.PAYFAST_MODE ?? 'sandbox'

  if (!merchantId || !merchantKey) {
    throw new Error('PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY not configured')
  }

  return { merchantId, merchantKey, passphrase, mode }
}

/**
 * PayFast signature generation per their docs:
 * 1. Build an alphabetically-sorted query string of all non-empty params
 * 2. Append passphrase if set
 * 3. MD5 hash the string
 * 4. Return lowercase hex
 */
function generateSignature(data: Record<string, string>, passphrase: string): string {
  // PayFast requires params in the exact order they appear in the form,
  // NOT alphabetical. We'll use insertion order.
  const params = Object.entries(data)
    .filter(([, v]) => v !== '' && v !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(v.trim()).replace(/%20/g, '+')}`)
    .join('&')

  const signatureString = passphrase ? `${params}&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}` : params

  return crypto.createHash('md5').update(signatureString).digest('hex')
}

/**
 * Validate PayFast ITN (Instant Transaction Notification) signature.
 */
function validateItnSignature(body: Record<string, string>, passphrase: string): boolean {
  // Remove 'signature' from the body to regenerate
  const { signature, ...data } = body

  const params = Object.entries(data)
    .filter(([, v]) => v !== '' && v !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(v.trim()).replace(/%20/g, '+')}`)
    .join('&')

  const signatureString = passphrase ? `${params}&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}` : params
  const expected = crypto.createHash('md5').update(signatureString).digest('hex')

  return expected === signature
}

export const payfastAdapter: PaymentProviderAdapter = {
  provider: 'payfast',

  async initialize(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const config = getConfig()
    const baseUrl = config.mode === 'sandbox' ? PAYFAST_SANDBOX_URL : PAYFAST_LIVE_URL

    // PayFast expects amount in rands (not cents), with 2 decimal places
    const amountRands = (input.amountCents / 100).toFixed(2)

    // Build the PayFast form data in the EXACT order PayFast requires
    const data: Record<string, string> = {
      merchant_id: config.merchantId,
      merchant_key: config.merchantKey,
      return_url: input.callbackUrl,
      cancel_url: input.cancelUrl ?? input.callbackUrl,
      notify_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/payfast-itn`,
      m_payment_id: input.reference,
      amount: amountRands,
      item_name: purposeToLabel(input.purpose),
      item_description: `Tri-Tender ${purposeToLabel(input.purpose)}`,
      email_address: input.email,
      ...(input.name ? { name_first: input.name.split(' ')[0], name_last: input.name.split(' ').slice(1).join(' ') || '' } : {}),
      custom_str1: input.purpose,
      custom_str2: JSON.stringify(input.metadata ?? {}),
    }

    // Generate signature
    const signature = generateSignature(data, config.passphrase)
    data.signature = signature

    // Build checkout URL with all params
    const queryString = Object.entries(data)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&')

    return {
      provider: 'payfast',
      providerPaymentId: input.reference,
      checkoutUrl: `${baseUrl}?${queryString}`,
    }
  },

  async verify(reference: string): Promise<VerifyPaymentResult> {
    // PayFast doesn't have a simple verify endpoint like Paystack.
    // Verification is done via ITN (webhook) and optionally via their
    // ad-hoc API query. For now, we rely on ITN.
    return {
      provider: 'payfast',
      providerPaymentId: reference,
      reference,
      status: 'pending',
      amountCents: 0,
      currency: 'ZAR',
    }
  },

  async validateWebhook(headers: Headers, body: string): Promise<WebhookValidationResult> {
    const config = getConfig()

    // PayFast ITN comes as application/x-www-form-urlencoded
    const params: Record<string, string> = {}
    const pairs = body.split('&')
    for (const pair of pairs) {
      const [key, ...valueParts] = pair.split('=')
      params[decodeURIComponent(key)] = decodeURIComponent(valueParts.join('='))
    }

    // Validate signature
    const isValid = validateItnSignature(params, config.passphrase)
    if (!isValid) {
      return { valid: false, provider: 'payfast', event: 'itn' }
    }

    // PayFast payment statuses: COMPLETE, FAILED, PENDING
    const pfStatus = params.payment_status
    const status = pfStatus === 'COMPLETE' ? 'success' : pfStatus === 'FAILED' ? 'failed' : 'pending'

    // Parse amount back to cents
    const amountCents = Math.round(parseFloat(params.amount_gross ?? '0') * 100)

    // Parse metadata from custom fields
    let metadata: Record<string, unknown> = {}
    try {
      metadata = JSON.parse(params.custom_str2 ?? '{}')
    } catch {
      // ignore parse errors
    }

    return {
      valid: true,
      provider: 'payfast',
      event: `payment_${status}`,
      reference: params.m_payment_id,
      providerPaymentId: params.pf_payment_id,
      status,
      amountCents,
      metadata: {
        ...metadata,
        purpose: params.custom_str1,
      },
    }
  },
}

function purposeToLabel(purpose: string): string {
  switch (purpose) {
    case 'setup_fee': return 'Account Setup Fee'
    case 'tender_full': return 'Tender Processing Fee'
    case 'tender_deposit': return 'Tender Deposit'
    case 'tender_balance': return 'Tender Balance Payment'
    case 'rush_upgrade': return 'Rush Processing Upgrade'
    default: return 'Tri-Tender Payment'
  }
}
