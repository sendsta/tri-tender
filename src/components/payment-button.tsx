'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { CreditCard, Loader2 } from 'lucide-react'

type PaymentProvider = 'paystack' | 'payfast'

function formatCents(cents: number) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 0,
  }).format(cents / 100)
}

interface PaymentButtonProps {
  /** API endpoint to call (e.g. /api/activation/setup-payment or /api/tenders/xxx/pay) */
  endpoint: string
  /** Amount in cents */
  amountCents: number
  /** Label for the button */
  label: string
  /** Additional body params to send */
  bodyParams?: Record<string, unknown>
  /** Variant */
  variant?: 'default' | 'outline'
  /** Full width */
  fullWidth?: boolean
}

export function PaymentButton({
  endpoint,
  amountCents,
  label,
  bodyParams,
  variant = 'default',
  fullWidth = false,
}: PaymentButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState<PaymentProvider | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handlePay(provider: PaymentProvider) {
    setLoading(provider)
    setError(null)

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          ...bodyParams,
        }),
      })

      const result = await res.json()

      if (!result.ok) {
        setError(result.error?.message ?? 'Payment initialization failed')
        setLoading(null)
        return
      }

      // Redirect to the payment provider's checkout
      window.location.href = result.data.checkoutUrl
    } catch {
      setError('An unexpected error occurred')
      setLoading(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
          variant === 'default'
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground'
        } ${fullWidth ? 'w-full' : ''}`}
      >
        <CreditCard className="h-4 w-4" />
        {label}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose payment method</DialogTitle>
          <DialogDescription>
            Pay {formatCents(amountCents)} using your preferred payment provider
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-4">
          {/* Paystack */}
          <button
            onClick={() => handlePay('paystack')}
            disabled={loading !== null}
            className="flex items-center gap-4 rounded-lg border-2 border-transparent p-4 text-left transition-all hover:border-primary hover:bg-primary/5 disabled:opacity-50"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#00C3F7]/10">
              <span className="text-lg font-bold text-[#00C3F7]">P</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Paystack</p>
              <p className="text-xs text-muted-foreground">
                Card, bank transfer, USSD, mobile money
              </p>
            </div>
            {loading === 'paystack' && <Loader2 className="h-4 w-4 animate-spin" />}
          </button>

          {/* PayFast */}
          <button
            onClick={() => handlePay('payfast')}
            disabled={loading !== null}
            className="flex items-center gap-4 rounded-lg border-2 border-transparent p-4 text-left transition-all hover:border-primary hover:bg-primary/5 disabled:opacity-50"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#00BAF2]/10">
              <span className="text-lg font-bold text-[#00BAF2]">PF</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">PayFast</p>
              <p className="text-xs text-muted-foreground">
                Card, EFT, SnapScan, Mobicred, Masterpass
              </p>
            </div>
            {loading === 'payfast' && <Loader2 className="h-4 w-4 animate-spin" />}
          </button>
        </div>

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Secure payment processing. You will be redirected to complete payment.
        </p>
      </DialogContent>
    </Dialog>
  )
}
