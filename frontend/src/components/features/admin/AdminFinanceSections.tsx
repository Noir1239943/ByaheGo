import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Banknote, Search } from 'lucide-react'
import { toast } from 'sonner'
import { StatCard } from '@/components/common/StatCard'
import { ErrorState, ListSkeleton } from '@/components/common/States'
import { PaymentStatusBadge } from '@/components/common/PaymentStatusBadge'
import { StatusBadge } from '@/components/common/StatusBadge'
import { adminInvoicePath, InvoiceLink } from '@/components/features/bookings/PaymentsList'
import { Avatar, Badge, Button, Card, EmptyState, Input, Modal, Pagination, Select, Table, Tabs, Textarea } from '@/components/ui'
import { useDebounce } from '@/hooks/useDebounce'
import { getErrorMessage } from '@/lib/api'
import { PAYMENT_METHODS, PAYMENT_TYPE_LABEL, PAYOUT_LABELS } from '@/lib/constants'
import { formatDate, formatDateTime, peso } from '@/lib/format'
import { adminService } from '@/services/admin'
import type { Payment, Payout } from '@/types'

export function AdminPaymentsSection() {
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [method, setMethod] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [handling, setHandling] = useState<Payment | null>(null)
  const [note, setNote] = useState('')
  const qc = useQueryClient()
  const dq = useDebounce(q)
  const params = { type: type || undefined, status: status || undefined, method: method || undefined, from: from || undefined, to: to || undefined, page, q: dq || undefined }
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'payments', params], queryFn: () => adminService.payments(params), placeholderData: keepPreviousData })
  const refresh = () => void qc.invalidateQueries({ queryKey: ['admin'] })
  const onErr = (e: unknown) => toast.error(getErrorMessage(e))
  const sync = useMutation({ mutationFn: (p: Payment) => adminService.syncPayment(p.id), onSuccess: (p) => { toast.success(p.status === 'pending' ? 'Still pending with Xendit.' : 'Updated from Xendit.'); refresh() }, onError: onErr })
  const retry = useMutation({ mutationFn: (p: Payment) => adminService.retryRefund(p.id), onSuccess: (p) => { toast.success(p.status === 'failed' ? 'Xendit refused it again. See the reason in the row.' : 'Refund sent to Xendit.'); refresh() }, onError: onErr })
  const handled = useMutation({ mutationFn: () => adminService.markRefundHandled(handling!.id, note), onSuccess: () => { toast.success('Marked as paid by hand.'); setHandling(null); setNote(''); refresh() }, onError: onErr })
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1) }
  return (
    <section>
      {data && (
        <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Collected" value={peso(data.summary.collected)} sub="Paid trips and balances" />
          <StatCard label="Refunded" value={peso(data.summary.refunded)} sub={data.summary.refunds_pending > 0 ? `${peso(data.summary.refunds_pending)} still processing` : 'Cancellations and deposits'} tone="info" />
          <StatCard label="Failed refunds" value={String(data.summary.refunds_failed)} sub="Retry or pay by hand" tone={data.summary.refunds_failed > 0 ? 'danger' : 'accent'} />
          <StatCard label="Fees deducted" value={peso(data.summary.fees)} sub="Late returns and damage" tone="accent" />
        </div>
      )}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Tabs variant="pill" value={type} onChange={reset(setType)} tabs={[{ value: '', label: 'All' }, { value: 'charge', label: 'Payments' }, { value: 'refund', label: 'Refunds' }, { value: 'late_fee', label: 'Late fees' }, { value: 'damage', label: 'Damage' }, { value: 'balance', label: 'Balances' }]} />
        <Input placeholder="Search receipt, booking or Xendit ID" leftIcon={<Search />} value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} className="h-9 w-72" aria-label="Search payments" />
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Select label="Status" value={status} onChange={(e) => reset(setStatus)(e.target.value)} options={[{ value: '', label: 'Any status' }, { value: 'succeeded', label: 'Succeeded' }, { value: 'pending', label: 'Pending' }, { value: 'failed', label: 'Failed' }, { value: 'expired', label: 'Expired' }]} />
        <Select label="Method" value={method} onChange={(e) => reset(setMethod)(e.target.value)} options={[{ value: '', label: 'Any method' }, ...PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label }))]} />
        <Input label="From" type="date" value={from} max={to || undefined} onChange={(e) => reset(setFrom)(e.target.value)} />
        <Input label="To" type="date" value={to} min={from || undefined} onChange={(e) => reset(setTo)(e.target.value)} />
      </div>
      <Card>
        {isLoading ? <div className="p-5"><ListSkeleton /></div> : error ? <ErrorState error={error} onRetry={() => void refetch()} /> : (
          <>
            <Table<Payment>
              rows={data!.data}
              rowKey={(p) => p.id}
              empty={<EmptyState icon={<Banknote />} title="No transactions match" />}
              columns={[
                { key: 'or', header: 'Receipt', className: 'whitespace-nowrap', cell: (p) => <><span className="font-mono text-xs">{p.receipt_no}</span>{p.invoice_no && <span className="block font-mono text-[11px] text-ink-400">{p.invoice_no}</span>}</> },
                { key: 'date', header: 'Date', cell: (p) => <span className="whitespace-nowrap text-ink-500">{formatDateTime(p.created_at)}</span> },
                { key: 'type', header: 'Type', cell: (p) => <Badge tone={p.type === 'refund' ? 'info' : p.type === 'charge' || p.type === 'balance' ? 'success' : 'accent'}>{PAYMENT_TYPE_LABEL[p.type]}</Badge> },
                { key: 'status', header: 'Status', cell: (p) => p.method === 'deposit' ? <span className="text-xs text-ink-500">From deposit</span> : <><PaymentStatusBadge p={p} admin />{p.failure_reason && <span className="mt-1 block max-w-[220px] text-xs text-danger">{p.failure_reason}</span>}</> },
                { key: 'who', header: 'Renter', cell: (p) => p.user?.name },
                { key: 'booking', header: 'Booking', cell: (p) => p.booking_reference && <Link to={`/admin/bookings/${p.booking_reference}`} className="font-medium text-brand hover:underline">{p.booking_reference}</Link> },
                { key: 'method', header: 'Method', cell: (p) => <>{p.method_label}<span className="block max-w-[180px] truncate font-mono text-[11px] text-ink-400" title={p.provider_refund_id ?? p.provider_payment_id ?? undefined}>{p.provider_refund_id ?? p.provider_payment_id ?? (p.method !== 'deposit' ? 'no Xendit ID' : '')}</span></> },
                { key: 'amount', header: 'Amount', headerClassName: 'text-right', className: 'text-right whitespace-nowrap', cell: (p) => <span className={p.type === 'refund' ? 'font-bold text-info' : 'font-bold'}>{p.type === 'refund' ? '−' : ''}{peso(p.amount)}</span> },
                {
                  key: 'actions', header: '', className: 'text-right whitespace-nowrap', cell: (p) => (
                    <div className="flex flex-col items-end gap-1">
                      <InvoiceLink p={p} path={adminInvoicePath} />
                      {p.status === 'pending' && <Button size="sm" variant="ghost" loading={sync.isPending && sync.variables?.id === p.id} onClick={() => sync.mutate(p)}>Check with Xendit</Button>}
                      {p.type === 'refund' && p.status === 'failed' && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="secondary" loading={retry.isPending && retry.variables?.id === p.id} onClick={() => retry.mutate(p)}>Retry</Button>
                          <Button size="sm" variant="ghost" onClick={() => { setHandling(p); setNote('') }}>Paid by hand</Button>
                        </div>
                      )}
                    </div>
                  ),
                },
              ]}
            />
            <div className="border-t border-line-100 p-4"><Pagination meta={data!.meta} onChange={setPage} label="transactions" /></div>
          </>
        )}
      </Card>

      <Modal open={!!handling} onClose={() => setHandling(null)} title="Refund paid by hand" description={handling ? `Use this only after you sent ${peso(handling.amount)} to the renter yourself (for example a GCash or bank transfer). It closes the refund and issues the refund receipt.` : undefined} size="sm" footer={<Button loading={handled.isPending} disabled={note.trim().length < 5} onClick={() => handled.mutate()}>Mark as paid</Button>}>
        <Textarea label="How did you pay it? (kept in the booking history)" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Sent ₱5,000 to the renter's GCash 0917…, ref 123456" />
      </Modal>
    </section>
  )
}

export function AdminPayoutsSection() {
  const [status, setStatus] = useState('scheduled')
  const [page, setPage] = useState(1)
  const qc = useQueryClient()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'payouts', status, page], queryFn: () => adminService.payouts({ status, page }), placeholderData: keepPreviousData })
  const pay = useMutation({ mutationFn: adminService.markPaid, onSuccess: () => { toast.success('Payout marked as sent. The host was notified.'); void qc.invalidateQueries({ queryKey: ['admin'] }) }, onError: (e) => toast.error(getErrorMessage(e)) })
  return (
    <section>
      {data && (
        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          <StatCard icon={<Banknote />} label="Due now" value={peso(data.summary.due_now)} tone="danger" sub="Scheduled date has passed" />
          <StatCard label="Scheduled" value={peso(data.summary.scheduled)} tone="accent" />
          <StatCard label="Paid to hosts" value={peso(data.summary.paid)} />
        </div>
      )}
      <Tabs className="mb-4" variant="pill" value={status} onChange={(s) => { setStatus(s); setPage(1) }} tabs={[{ value: 'scheduled', label: 'To send' }, { value: 'paid', label: 'Paid' }, { value: 'all', label: 'All' }]} />
      <Card>
        {isLoading ? <div className="p-5"><ListSkeleton /></div> : error ? <ErrorState error={error} onRetry={() => void refetch()} /> : (
          <>
            <Table<Payout>
              rows={data!.data}
              rowKey={(p) => p.id}
              empty={<EmptyState icon={<Banknote />} title="Nothing to send" description="All host payouts are up to date." />}
              columns={[
                { key: 'host', header: 'Host', cell: (p) => <div className="flex items-center gap-2.5"><Avatar initials={p.host?.initials ?? '?'} size="sm" seed={p.host?.id} /><div><p className="font-medium">{p.host?.name}</p><p className="text-xs text-ink-500">{PAYOUT_LABELS[p.payout_method ?? ''] ?? '—'} {p.account}</p></div></div> },
                { key: 'trip', header: 'Trip', cell: (p) => <><Link to={`/admin/bookings/${p.booking_reference}`} className="font-medium text-brand">{p.booking_reference}</Link><p className="text-xs text-ink-500">{p.vehicle_name}</p></> },
                { key: 'date', header: 'Scheduled', cell: (p) => <span className={new Date(p.scheduled_for ?? '') <= new Date() && p.status === 'scheduled' ? 'font-semibold text-danger' : ''}>{formatDate(p.scheduled_for)}</span> },
                { key: 'status', header: 'Status', cell: (p) => <><StatusBadge status={p.status} />{p.reference && <p className="mt-1 font-mono text-[11px] text-ink-400">{p.reference}</p>}</> },
                { key: 'amount', header: 'Amount', cell: (p) => <span className="font-bold">{peso(p.amount)}</span> },
                { key: 'act', header: '', className: 'text-right', cell: (p) => p.status === 'scheduled' && <Button size="sm" loading={pay.isPending && pay.variables === p.id} onClick={() => pay.mutate(p.id)}>Mark as sent</Button> },
              ]}
            />
            <div className="border-t border-line-100 p-4"><Pagination meta={data!.meta} onChange={setPage} label="payouts" /></div>
          </>
        )}
      </Card>
    </section>
  )
}
