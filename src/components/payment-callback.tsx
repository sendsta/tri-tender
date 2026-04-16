'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'

export function PaymentCallback() {
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const payment = searchParams.get('payment')
    if (payment === 'success') {
      toast.success('Payment confirmed', {
        description: 'Your payment has been processed successfully.',
      })
      // Clean the URL
      const url = new URL(window.location.href)
      url.searchParams.delete('payment')
      url.searchParams.delete('ref')
      router.replace(url.pathname, { scroll: false })
    } else if (payment === 'cancelled') {
      toast.error('Payment cancelled', {
        description: 'Your payment was cancelled. You can try again.',
      })
      const url = new URL(window.location.href)
      url.searchParams.delete('payment')
      router.replace(url.pathname, { scroll: false })
    }
  }, [searchParams, router])

  return null
}
