import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Banknote, Search } from 'lucide-react'
import { toast } from 'sonner'
import { StatCard } from '@/components/common/StatCard'
import { ErrorState, ListSkeleton } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Avatar, Badge, Button, Card, EmptyState, Input, Pagination, Table, Tabs } from '@/components/ui'
import { useDebounce } from '@/hooks/useDebounce'
import { getErrorMessage } from '@/lib/api'
import { PAYMENT_TYPE_LABEL, PAYOUT_LABELS } from '@/lib/constants'
import { formatDate, formatDateTime, peso } from '@/lib/format'
import { adminService } from '@/services/admin'
import type { Payment, Payout } from '@/types'

export function AdminPaymentsSection() {
  const [type, setType] = useState('')
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const dq = useDebounce(q)
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'payments', type, page, dq], queryFn: () => adminService.payments({ type: type || undefined, page, q: dq || undefined }), placeholderData: keepPreviousData })
  return (
    <section>
      {data && (
        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          <StatCard label="Collected" value={peso(data.summary.collected)} sub="Trip payments and balances" />
          <StatCard label="Refunded" value={peso(data.summary.refunded)} sub="Cancellations and deposits" tone="info" />
          <StatCard label="Fees deducted" value={peso(data.summary.fees)} sub="Late returns and damage" tone="accent" />
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs variant="pill" value={type} onChange={(t) => { setType(t); setPage(1) }} tabs={[{ value: '', label: 'All' }, { value: 'charge', label: 'Payments' }, { value: 'refund', label: 'Refunds' }, { value: 'late_fee', label: 'Late fees' }, { value: 'damage', label: 'Damage' }, { value: 'balance', label: 'Balances' }]} />
        <Input placeholder="Search OR no. or booking" leftIcon={<Search />} value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} className="h-9 w-64" aria-label="Search payments" />
      </div>
      <Card>
        {isLoading ? <div className="p-5"><ListSkeleton /></div> : error ? <ErrorState error={error} onRetry={() => void refetch()} /> : (
          <>
            <Table<Payment>
              rows={data!.data}
              rowKey={(p) => p.id}
              columns={[
                { key: 'or', header: 'Receipt', cell: (p) => <span className="font-mono text-xs">{p.receipt_no}</span> },
                { key: 'date', header: 'Date', cell: (p) => <span className="whitespace-nowrap text-ink-500">{formatDateTime(p.created_at)}</span> },
                { key: 'type', header: 'Type', cell: (p) => <Badge tone={p.type === 'refund' ? 'info' : p.type === 'charge' || p.type === 'balance' ? 'success' : 'accent'}>{PAYMENT_TYPE_LABEL[p.type]}</Badge> },
                { key: 'who', header: 'Renter', cell: (p) => p.user?.name },
                { key: 'booking', header: 'Booking', cell: (p) => p.booking_reference && <Link to={`/admin/bookings/${p.booking_reference}`} className="font-medium text-brand hover:underline">{p.booking_reference}</Link> },
                { key: 'method', header: 'Method', cell: (p) => <>{p.method_label}<span className="block text-xs text-ink-400">{p.method !== 'deposit' && p.account_hint}{p.gateway_ref && ` · ${p.gateway_ref}`}</span></> },
                { key: 'amount', header: 'Amount', headerClassName: 'text-right', className: 'text-right', cell: (p) => <span className={p.type === 'refund' ? 'font-bold text-info' : 'font-bold'}>{p.type === 'refund' ? '−' : ''}{peso(p.amount)}</span> },
              ]}
            />
            <div className="border-t border-line-100 p-4"><Pagination meta={data!.meta} onChange={setPage} label="transactions" /></div>
          </>
        )}
      </Card>
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
