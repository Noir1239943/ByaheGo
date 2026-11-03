import { ShieldCheck } from 'lucide-react'
import { KeyValue } from '@/components/common/InfoRow'
import { cn } from '@/lib/cn'
import { peso } from '@/lib/format'
import type { Booking } from '@/types'

const LABEL: Record<string, [string, string]> = {
  held: ['Held', 'Your deposit is on hold until the vehicle is checked at return.'],
  on_hold: ['Under review', 'A report was filed at return. We\'ll decide within 48 hours and update you.'],
  released: ['Returned in full', 'Your whole deposit went back to your payment method.'],
  partially_released: ['Partly returned', 'Some of your deposit covered trip charges; the rest was returned.'],
  applied: ['Used for charges', 'Your deposit covered trip charges.'],
  refunded: ['Refunded', 'Refunded with your cancellation.'],
}

export function DepositCard({ b, className }: { b: Booking; className?: string }) {
  const [label, text] = LABEL[b.deposit_status] ?? [b.deposit_status, '']
  return (
    <div className={cn('rounded-2xl border border-line-200 bg-white p-5', className)}>
      <p className="flex items-center gap-2 font-bold"><ShieldCheck className="size-4.5 text-brand" /> Security deposit · {label}</p>
      <p className="mt-1 text-sm text-ink-500">{text}</p>
      <div className="mt-3 divide-y divide-line-100">
        <KeyValue label="Deposit" value={peso(b.security_deposit)} />
        {b.late_fee > 0 && <KeyValue label={`Late return (${b.late_hours} h)`} value={`−${peso(b.late_fee)}`} />}
        {b.damage_charge > 0 && <KeyValue label="Approved damage" value={`−${peso(b.damage_charge)}`} />}
        {['released', 'partially_released', 'applied'].includes(b.deposit_status) && <KeyValue label="Returned to you" value={peso(b.deposit_refunded)} strong />}
        {b.balance_due > 0 && <KeyValue label="Balance due" value={<span className="text-danger">{peso(b.balance_due)}</span>} strong />}
      </div>
    </div>
  )
}
