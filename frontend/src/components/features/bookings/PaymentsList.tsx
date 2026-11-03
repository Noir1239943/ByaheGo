import { ArrowDownLeft, ArrowUpRight, MinusCircle } from 'lucide-react'
import { cn } from '@/lib/cn'
import { PAYMENT_TYPE_LABEL } from '@/lib/constants'
import { formatDateTime, peso } from '@/lib/format'
import type { Payment } from '@/types'


export function PaymentsList({ payments, showBooking }: { payments: Payment[]; showBooking?: boolean }) {
  if (!payments.length) return <p className="text-sm text-ink-500">No payments yet.</p>
  return (
    <ul className="divide-y divide-line-100">
      {payments.map((p) => {
        const refund = p.type === 'refund'
        const fromDeposit = p.method === 'deposit'
        const Icon = refund ? ArrowDownLeft : fromDeposit ? MinusCircle : ArrowUpRight
        return (
          <li key={p.id} className="flex items-start gap-3 py-3">
            <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg', refund ? 'bg-success-soft text-success' : fromDeposit ? 'bg-accent-soft text-warning' : 'bg-line-100 text-ink-700')}>
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{PAYMENT_TYPE_LABEL[p.type] ?? p.type}{showBooking && p.booking_reference && <span className="font-normal text-ink-500"> · {p.booking_reference}</span>}</p>
              <p className="text-xs text-ink-500">{p.description}</p>
              <p className="mt-0.5 text-[11px] text-ink-400">
                {formatDateTime(p.created_at)} · {p.method_label}{p.account_hint && p.method !== 'deposit' ? ` ${p.account_hint}` : ''} · {p.receipt_no}
              </p>
            </div>
            <span className={cn('text-sm font-bold whitespace-nowrap', refund ? 'text-success' : 'text-ink-900')}>
              {refund ? '+' : ''}{peso(p.amount)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
