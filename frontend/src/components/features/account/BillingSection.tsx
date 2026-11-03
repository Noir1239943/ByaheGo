import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { ArrowDownLeft, Clock, CreditCard, ReceiptText, ShieldCheck, Wallet } from 'lucide-react'
import { PageTitle } from '@/components/common/SectionHeading'
import { PaymentStatusBadge } from '@/components/common/PaymentStatusBadge'
import { StatCard } from '@/components/common/StatCard'
import { ErrorState, ListSkeleton } from '@/components/common/States'
import { InvoiceLink } from '@/components/features/bookings/PaymentsList'
import { Alert, Card, EmptyState, Input, Pagination, Select, Table, Tabs } from '@/components/ui'
import { PAYMENT_TYPE_LABEL } from '@/lib/constants'
import { formatDate, peso } from '@/lib/format'
import { accountService } from '@/services/account'
import type { Payment } from '@/types'

const STATUS_OPTIONS = [
  { value: '', label: 'Any status' },
  { value: 'succeeded', label: 'Paid / done' },
  { value: 'pending', label: 'Processing' },
  { value: 'failed', label: 'Failed' },
  { value: 'expired', label: 'Expired' },
]

export function BillingSection() {
  const [tab, setTab] = useState<'' | 'payments' | 'refunds' | 'deposits' | 'fees'>('')
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const params = { type: tab || undefined, status: status || undefined, from: from || undefined, to: to || undefined, page }
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['billing', params], queryFn: () => accountService.billing(params), placeholderData: keepPreviousData })
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1) }

  if (isLoading) return <ListSkeleton />
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />
  const s = data.summary
  return (
    <section>
      <PageTitle title="Payments & billing" description="Every payment, deposit, refund and fee, with invoices you can download." />
      {s.balance_due > 0 && <Alert tone="danger" className="mb-5" title={`You have ${peso(s.balance_due)} due`}>Open the trip in My trips to settle it.</Alert>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<CreditCard />} label="Total paid" value={peso(s.total_paid)} />
        <StatCard icon={<ArrowDownLeft />} label="Refunded to you" value={peso(s.total_refunded)} sub={s.refunds_pending > 0 ? `${peso(s.refunds_pending)} still processing` : undefined} tone="info" />
        <StatCard icon={<Wallet />} label="Fees & charges" value={peso(s.fees_and_charges)} sub="Late returns or damage" tone="accent" />
        <StatCard icon={<ShieldCheck />} label="Deposits on hold" value={peso(s.deposits_on_hold)} sub="Returned after each trip" />
      </div>
      <Card className="mt-5">
        <div className="px-5 pt-4"><Tabs value={tab} onChange={reset(setTab)} tabs={[{ value: '', label: 'All' }, { value: 'payments', label: 'Payments' }, { value: 'deposits', label: 'Deposit deductions' }, { value: 'refunds', label: 'Refunds' }, { value: 'fees', label: 'Fees' }]} /></div>
        <div className="grid gap-3 px-5 pt-4 sm:grid-cols-3">
          <Select label="Status" value={status} onChange={(e) => reset(setStatus)(e.target.value)} options={STATUS_OPTIONS} />
          <Input label="From" type="date" value={from} max={to || undefined} onChange={(e) => reset(setFrom)(e.target.value)} />
          <Input label="To" type="date" value={to} min={from || undefined} onChange={(e) => reset(setTo)(e.target.value)} />
        </div>
        <Table<Payment>
          rows={data.data}
          rowKey={(p) => p.id}
          empty={<EmptyState icon={<ReceiptText />} title="No transactions match" description="Try a different filter or date range." />}
          columns={[
            { key: 'date', header: 'Date', cell: (p) => <span className="whitespace-nowrap text-ink-500">{formatDate(p.created_at)}</span> },
            { key: 'desc', header: 'Description', cell: (p) => <><p className="font-semibold">{PAYMENT_TYPE_LABEL[p.type]}</p><p className="max-w-xs truncate text-xs text-ink-500">{p.vehicle_name ?? p.description}</p>{p.status === 'failed' && p.type !== 'refund' && p.failure_reason && <p className="max-w-xs text-xs text-danger">{p.failure_reason}</p>}</> },
            { key: 'trip', header: 'Trip', cell: (p) => p.booking_reference && <Link to={`/account/trips/${p.booking_reference}`} className="font-medium text-brand hover:underline">{p.booking_reference}</Link> },
            { key: 'method', header: 'Method', cell: (p) => <span className="text-ink-700">{p.method_label}</span> },
            { key: 'status', header: 'Status', cell: (p) => p.method === 'deposit' ? <span className="inline-flex items-center gap-1 text-xs text-ink-500"><Clock className="size-3" /> From deposit</span> : <PaymentStatusBadge p={p} /> },
            { key: 'amount', header: 'Amount', headerClassName: 'text-right', className: 'text-right', cell: (p) => <span className={p.type === 'refund' ? 'font-bold text-success' : 'font-bold'}>{p.type === 'refund' ? '+' : ''}{peso(p.amount)}</span> },
            { key: 'or', header: 'Invoice', cell: (p) => <InvoiceLink p={p} /> },
          ]}
        />
        <div className="border-t border-line-100 p-4"><Pagination meta={data.meta} onChange={setPage} label="transactions" /></div>
      </Card>
    </section>
  )
}
