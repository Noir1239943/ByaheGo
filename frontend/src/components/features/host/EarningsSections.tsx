import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Banknote, CalendarClock, CircleDollarSign, Wallet } from 'lucide-react'
import { BarChart } from '@/components/common/BarChart'
import { StatCard } from '@/components/common/StatCard'
import { ErrorState, ListSkeleton } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button, Card, CardBody, CardHeader, EmptyState, Table } from '@/components/ui'
import { PAYOUT_LABELS } from '@/lib/constants'
import { formatDate, peso } from '@/lib/format'
import { hostService, type HostEarnings } from '@/services/host'
import { PayoutAccountModal } from './PayoutAccountModal'

function useEarnings() {
  return useQuery({ queryKey: ['host', 'earnings'], queryFn: hostService.earnings })
}

export function EarningsSummarySection() {
  const { data, isLoading, error, refetch } = useEarnings()
  if (isLoading) return <ListSkeleton rows={1} />
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />
  const s = data.summary
  return (
    <section className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard icon={<Wallet />} label="This month" value={peso(s.this_month)} />
      <StatCard icon={<CalendarClock />} label="Scheduled payouts" value={peso(s.scheduled)} tone="accent" sub="Sent 3 days after each trip" />
      <StatCard icon={<Banknote />} label="Paid out" value={peso(s.paid_out)} tone="info" />
      <StatCard icon={<CircleDollarSign />} label="Lifetime earnings" value={peso(s.lifetime)} sub={`${s.trips} completed trips`} />
    </section>
  )
}

export function EarningsChartSection() {
  const { data } = useEarnings()
  const [open, setOpen] = useState(false)
  if (!data) return null
  return (
    <section className="mb-5 grid gap-5 xl:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader title="Monthly earnings" description="Last 12 months, after commission" />
        <CardBody><BarChart data={data.months} /></CardBody>
      </Card>
      <Card className="flex flex-col p-5">
        <p className="font-bold">Payout account</p>
        {data.payout_account ? (
          <div className="mt-3 rounded-2xl bg-hero p-4 text-white">
            <p className="text-xs text-white/60">{PAYOUT_LABELS[data.payout_account.method]}</p>
            <p className="mt-1 text-lg font-bold">{data.payout_account.account_masked}</p>
            <p className="text-sm text-white/80">{data.payout_account.account_name}</p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink-500">Add where we should send your earnings.</p>
        )}
        <Button variant="secondary" className="mt-auto pt-0" onClick={() => setOpen(true)}>{data.payout_account ? 'Change account' : 'Add payout account'}</Button>
        <PayoutAccountModal open={open} onClose={() => setOpen(false)} />
      </Card>
    </section>
  )
}

export function PayoutsSection() {
  const { data } = useEarnings()
  if (!data) return null
  return (
    <Card>
      <CardHeader title="Payouts" description="One payout per completed trip" />
      <Table<HostEarnings['payouts'][number]>
        rows={data.payouts}
        rowKey={(p) => p.id}
        empty={<EmptyState icon={<Wallet />} title="No payouts yet" description="Payouts appear here after your first completed trip." />}
        columns={[
          { key: 'trip', header: 'Trip', cell: (p) => <><p className="font-semibold">{p.vehicle_name}</p><p className="text-xs text-ink-500">{p.booking_reference}</p></> },
          { key: 'date', header: 'Payout date', cell: (p) => (p.paid_at ? formatDate(p.paid_at) : formatDate(p.scheduled_for)) },
          { key: 'ref', header: 'Reference', cell: (p) => <span className="font-mono text-xs">{p.reference ?? '—'}</span> },
          { key: 'status', header: 'Status', cell: (p) => <StatusBadge status={p.status} /> },
          { key: 'amount', header: 'Amount', headerClassName: 'text-right', className: 'text-right', cell: (p) => <span className="font-bold">{peso(p.amount)}</span> },
        ]}
      />
    </Card>
  )
}
