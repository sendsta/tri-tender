import crypto from 'crypto'
import type {
  PaymentProviderAdapter,
  InitializePaymentInput,
  InitializePaymentResult,
  VerifyPaymentResult,
  WebhookValidationResult,
} from './types'

const PAYSTACK_BASE = 'https://api.paystack.co'

function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key) throw new Error('PAYSTACK_SECRET_KEY not configured')
  return key
}

async function paystackRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const data = await res.json()
  if (!res.ok || !data.status) {
    throw new Error(data.message ?? `Paystack API error: ${res.status}`)
  }
  return data.data as T
}

export const paystackAdapter: PaymentProviderAdapter = {
  provider: 'paystack',

  async initialize(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const data = await paystackRequest<{
      authorization_url: string
      access_code: string
      reference: string
    }>('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: input.email,
        amount: input.amountCents, // Paystack uses amount in kobo/cents
        currency: input.currency,
        reference: input.reference,
        callback_url: input.callbackUrl,
        metadata: {
          ...input.metadata,
          purpose: input.purpose,
          custom_fields: [
            {
              display_name: 'Purpose',
              variable_name: 'purpose',
              value: input.purpose,
            },
          ],
        },
      }),
    })

    return {
      provider: 'paystack',
      providerPaymentId: data.reference,
      checkoutUrl: data.authorization_url,
      accessCode: data.access_code,
    }
  },

  async verify(reference: string): Promise<VerifyPaymentResult> {
    const data = await paystackRequest<{
      reference: string
      status: string
      amount: number
      currency: string
      paid_at: string | null
      metadata: Record<string, unknown> | null
    }>(`/transaction/verify/${encodeURIComponent(reference)}`)

    return {
      provider: 'paystack',
      providerPaymentId: reference,
      reference: data.reference,
      status: data.status === 'success' ? 'success' : data.status === 'failed' ? 'failed' : 'pending',
      amountCents: data.amount,
      currency: data.currency,
      paidAt: data.paid_at ?? undefined,
      metadata: data.metadata ?? undefined,
    }
  },

  async validateWebhook(headers: Headers, body: string): Promise<WebhookValidationResult> {
    const signature = headers.get('x-paystack-signature')
    if (!signature) {
      return { valid: false, provider: 'paystack', event: 'unknown' }
    }

    // HMAC SHA512 verification
    const hash = crypto
      .createHmac('sha512', getSecretKey())
      .update(body)
      .digest('hex')

    if (hash !== signature) {
      return { valid: false, provider: 'paystack', event: 'unknown' }
    }

    const payload = JSON.parse(body)
    const event = payload.event as string
    const data = payload.data as Record<string, unknown>

    return {
      valid: true,
      provider: 'paystack',
      event,
      reference: data.reference as string,
      providerPaymentId: data.reference as string,
      status: event === 'charge.success' ? 'success' : 'failed',
      amountCents: data.amount as number,
      metadata: data.metadata as Record<string, unknown> | undefined,
    }
  },
}
