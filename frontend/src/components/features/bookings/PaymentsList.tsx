import { ArrowDownLeft, ArrowUpRight, Download, MinusCircle } from 'lucide-react'
import { toast } from 'sonner'
import { PaymentStatusBadge } from '@/components/common/PaymentStatusBadge'
import { cn } from '@/lib/cn'
import { getErrorMessage } from '@/lib/api'
import { PAYMENT_TYPE_LABEL } from '@/lib/constants'
import { downloadFile } from '@/lib/download'
import { formatDateTime, peso } from '@/lib/format'
import type { Payment } from '@/types'

/** Where the invoice PDF of a payment lives for the person looking at it (renters and admins use different routes). */
export const renterInvoicePath = (p: Payment) => `/payments/${p.id}/invoice.pdf`
export const adminInvoicePath = (p: Payment) => `/admin/payments/${p.id}/invoice.pdf`

export function InvoiceLink({ p, path = renterInvoicePath }: { p: Payment; path?: (p: Payment) => string }) {
  if (!p.invoice_no) return null
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline"
      onClick={() => void downloadFile(path(p), `ByaheGo-${p.invoice_no}.pdf`).catch((e) => toast.error(getErrorMessage(e)))}
    >
      <Download className="size-3" /> {p.invoice_kind === 'refund_receipt' ? 'Refund receipt' : 'Invoice'} {p.invoice_no}
    </button>
  )
}

export function PaymentsList({ payments, showBooking, invoicePath = renterInvoicePath }: { payments: Payment[]; showBooking?: boolean; invoicePath?: (p: Payment) => string }) {
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
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
                {PAYMENT_TYPE_LABEL[p.type] ?? p.type}
                {showBooking && p.booking_reference && <span className="font-normal text-ink-500">· {p.booking_reference}</span>}
                {!fromDeposit && p.type !== 'cancellation_fee' && <PaymentStatusBadge p={p} admin={invoicePath !== renterInvoicePath} />}
              </p>
              <p className="text-xs text-ink-500">{p.description}</p>
              {p.status === 'failed' && p.failure_reason && (p.type !== 'refund' || invoicePath !== renterInvoicePath) && <p className="mt-0.5 text-xs text-danger">{p.failure_reason}</p>}
              <p className="mt-0.5 text-[11px] text-ink-400">
                {formatDateTime(p.created_at)} · {p.method_label}{p.account_hint && p.method !== 'deposit' && p.account_hint !== p.method_label ? ` ${p.account_hint}` : ''} · {p.receipt_no}
              </p>
              <InvoiceLink p={p} path={invoicePath} />
            </div>
            <span className={cn('text-sm font-bold whitespace-nowrap', refund ? 'text-success' : 'text-ink-900', ['failed', 'expired'].includes(p.status) && !refund && 'text-ink-400 line-through')}>
              {refund ? '+' : ''}{peso(p.amount)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
