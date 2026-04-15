import type { PaymentProvider, PaymentProviderAdapter } from './types'
import { paystackAdapter } from './paystack'
import { payfastAdapter } from './payfast'

export type { PaymentProvider, PaymentPurpose, InitializePaymentInput, InitializePaymentResult } from './types'

const adapters: Record<PaymentProvider, PaymentProviderAdapter> = {
  paystack: paystackAdapter,
  payfast: payfastAdapter,
}

export function getPaymentAdapter(provider: PaymentProvider): PaymentProviderAdapter {
  const adapter = adapters[provider]
  if (!adapter) {
    throw new Error(`Unknown payment provider: ${provider}`)
  }
  return adapter
}

/** Check which providers are configured (have env vars set) */
export function getAvailableProviders(): PaymentProvider[] {
  const available: PaymentProvider[] = []

  if (process.env.PAYSTACK_SECRET_KEY) {
    available.push('paystack')
  }
  if (process.env.PAYFAST_MERCHANT_ID && process.env.PAYFAST_MERCHANT_KEY) {
    available.push('payfast')
  }

  return available
}

/** Get the default provider (first available) */
export function getDefaultProvider(): PaymentProvider {
  const available = getAvailableProviders()
  if (available.length === 0) {
    throw new Error('No payment providers configured')
  }
  return available[0]
}
