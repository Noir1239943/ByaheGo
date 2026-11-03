import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'
import type { Booking } from '@/types'

/** Trip progress from booking to deposit release. */
export function TripTimeline({ b, className }: { b: Booking; className?: string }) {
  if (b.status === 'cancelled') {
    return (
      <ol className={cn('grid gap-4 sm:grid-cols-3', className)}>
        <Step done label="Booked" sub={formatDateTime(b.created_at)} />
        <Step done label="Cancelled" sub={formatDateTime(b.cancelled_at)} tone="danger" />
        <Step done={b.payment_status === 'refunded'} label="Refunded" sub={b.payment_status === 'refunded' ? 'Back to your payment method' : 'Processing'} />
      </ol>
    )
  }
  const settled = ['released', 'partially_released', 'applied'].includes(b.deposit_status)
  const steps = [
    { label: 'Booked & paid', sub: formatDateTime(b.created_at), done: true },
    { label: 'Picked up', sub: b.actual_pickup_at ? formatDateTime(b.actual_pickup_at) : formatDateTime(b.pickup_at), done: !!b.actual_pickup_at },
    { label: 'Returned', sub: b.actual_return_at ? formatDateTime(b.actual_return_at) : `Due ${formatDateTime(b.return_at)}`, done: !!b.actual_return_at },
    { label: b.deposit_status === 'on_hold' ? 'Deposit under review' : 'Deposit settled', sub: settled ? 'All done' : b.deposit_status === 'on_hold' ? 'Our team is reviewing a report' : 'Within 3 days of return', done: settled },
  ]
  return (
    <ol className={cn('grid gap-4 sm:grid-cols-4', className)}>
      {steps.map((s, i) => (
        <Step key={s.label} {...s} index={i + 1} tone={s.label.includes('review') ? 'warning' : undefined} />
      ))}
    </ol>
  )
}

function Step({ label, sub, done, index, tone }: { label: string; sub: string; done: boolean; index?: number; tone?: 'danger' | 'warning' }) {
  return (
    <li className="flex items-start gap-3 sm:flex-col sm:gap-2">
      <span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
          done ? (tone === 'danger' ? 'bg-danger text-white' : 'bg-brand text-white') : tone === 'warning' ? 'bg-accent-soft text-warning' : 'border border-line-200 bg-white text-ink-400',
        )}
      >
        {done ? <Check className="size-4" strokeWidth={3} /> : index}
      </span>
      <span>
        <span className={cn('block text-sm font-semibold', !done && 'text-ink-500')}>{label}</span>
        <span className="block text-xs text-ink-500">{sub}</span>
      </span>
    </li>
  )
}
