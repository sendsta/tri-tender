import { cn } from '@/lib/utils'

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  queued: { label: 'Queued', className: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300' },
  preflight: { label: 'Preflight', className: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300' },
  awaiting_payment: { label: 'Awaiting Payment', className: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300' },
  in_progress: { label: 'In Progress', className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300' },
  running: { label: 'In Progress', className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300' },
  blocked: { label: 'Blocked', className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300' },
  completed: { label: 'Ready', className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300' },
  complete: { label: 'Complete', className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300' },
  failed: { label: 'Failed', className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300' },
  no_bid: { label: 'No Bid', className: 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400' },
}

export function StatusBadge({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: '' }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  )
}

const PAYMENT_STATE_CONFIG: Record<string, { label: string; className: string }> = {
  awaiting_setup: { label: 'Setup Required', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  awaiting_quote: { label: 'Awaiting Quote', className: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
  awaiting_quote_acceptance: { label: 'Quote Pending', className: 'bg-purple-50 text-purple-700 border-purple-200' },
  awaiting_full_payment: { label: 'Payment Required', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  awaiting_deposit: { label: 'Deposit Required', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  deposit_paid: { label: 'Deposit Paid', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  paid: { label: 'Paid', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
}

export function PaymentBadge({
  state,
  className,
}: {
  state: string
  className?: string
}) {
  const config = PAYMENT_STATE_CONFIG[state] ?? { label: state, className: '' }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  )
}
