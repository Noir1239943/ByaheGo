import { Info } from 'lucide-react'
import { cn } from '@/lib/cn'
import { peso } from '@/lib/format'

type Lines = {
  daily_rate: number
  days: number
  rental_subtotal: number
  weekly_discount?: number
  driver_fee_total: number
  protection_total: number
  protection_name?: string
  service_fee: number
  total: number
  security_deposit?: number
}

export function PriceBreakdown({ q, className, showDeposit = true, totalLabel = 'Trip total' }: { q: Lines; className?: string; showDeposit?: boolean; totalLabel?: string }) {
  return (
    <div className={cn('space-y-2.5 text-sm', className)}>
      <Row label={`${peso(q.daily_rate)} × ${q.days} day${q.days > 1 ? 's' : ''}`} value={peso(q.rental_subtotal + (q.weekly_discount ?? 0))} />
      {!!q.weekly_discount && <Row label="Weekly rate savings" value={`−${peso(q.weekly_discount)}`} valueClass="text-success" />}
      {q.driver_fee_total > 0 && <Row label="Driver fee" value={peso(q.driver_fee_total)} />}
      <Row label={q.protection_name ?? 'Protection'} value={q.protection_total > 0 ? peso(q.protection_total) : 'Included'} valueClass={q.protection_total > 0 ? undefined : 'text-success font-semibold'} />
      <Row label="Service fee" value={peso(q.service_fee)} hint="Covers 24/7 roadside help and customer support." />
      <div className="flex items-center justify-between border-t border-line-200 pt-3 text-base font-bold text-ink-900">
        <span>{totalLabel}</span>
        <span>{peso(q.total)}</span>
      </div>
      {showDeposit && !!q.security_deposit && (
        <>
          <Row label="Refundable security deposit" value={peso(q.security_deposit)} hint="Held during your trip and returned after the car is checked." />
          <div className="flex items-center justify-between rounded-xl bg-brand-tint px-3 py-2.5 font-bold text-brand-dark">
            <span>Due today</span>
            <span>{peso(q.total + q.security_deposit)}</span>
          </div>
        </>
      )}
    </div>
  )
}

function Row({ label, value, valueClass, hint }: { label: string; value: string; valueClass?: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-ink-500">
      <span className="flex items-center gap-1">
        {label}
        {hint && (
          <span title={hint} className="cursor-help text-ink-400">
            <Info className="size-3.5" />
          </span>
        )}
      </span>
      <span className={cn('font-medium text-ink-900', valueClass)}>{value}</span>
    </div>
  )
}
