import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ArrowRight, BadgeCheck, Banknote, Car, ChevronRight, Gavel, Headset, Store, TrendingDown, TrendingUp } from 'lucide-react'
import { BarChart } from '@/components/common/BarChart'
import { ErrorState, ListSkeleton } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { tripStatus } from '@/lib/status'
import { Avatar, Badge, Card, CardBody, CardHeader, Table, Tabs } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/cn'
import { compactPeso, formatRange, peso } from '@/lib/format'
import { adminService } from '@/services/admin'
import type { BookingRow } from '@/types'

type Range = 'today' | '7d' | '30d' | 'year'

function useOverview() {
  const [params] = useSearchParams()
  const range = (params.get('range') as Range) || '30d'
  return { range, ...useQuery({ queryKey: ['admin', 'overview', range], queryFn: () => adminService.overview(range) }) }
}

export function AdminGreetingSection() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const range = (params.get('range') as Range) || '30d'
  const h = new Date().getHours()
  return (
    <section className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'}, {user?.name.split(' ')[0]}</h2>
        <p className="mt-1 text-sm text-ink-500">Here's what's happening across ByaheGo today, {new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}.</p>
      </div>
      <Tabs variant="pill" value={range} onChange={(r) => setParams({ range: r })} tabs={[{ value: 'today', label: 'Today' }, { value: '7d', label: '7 days' }, { value: '30d', label: '30 days' }, { value: 'year', label: 'This year' }]} />
    </section>
  )
}

export function AdminKpiSection() {
  const { data, isLoading, error, refetch } = useOverview()
  if (isLoading) return <ListSkeleton rows={1} />
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />
  const k = data.kpis
  const up = (k.gbv_change ?? 0) >= 0
  const cards = [
    { label: 'Gross booking value', value: compactPeso(k.gross_booking_value), sub: k.gbv_change !== null ? <span className={cn('inline-flex items-center gap-1 font-semibold', up ? 'text-success' : 'text-danger')}>{up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}{up ? '+' : ''}{k.gbv_change}% vs previous</span> : 'No earlier data' },
    { label: 'Platform revenue', value: peso(k.platform_revenue), sub: 'Service fees + commission' },
    { label: 'Active rentals', value: k.active_rentals, sub: `${k.returns_today} returns due today` },
    { label: 'Bookings', value: k.bookings, sub: `${k.cancellation_rate}% cancellation rate` },
  ]
  return (
    <section className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label} className="p-5">
          <p className="text-xs font-medium text-ink-500">{c.label}</p>
          <p className="mt-1 text-2xl font-extrabold tracking-tight">{c.value}</p>
          <p className="mt-1 text-xs text-ink-500">{c.sub}</p>
        </Card>
      ))}
    </section>
  )
}

export function AdminRevenueSection() {
  const { data } = useOverview()
  if (!data) return null
  const a = data.attention
  const items = [
    { to: '/admin/verifications', icon: BadgeCheck, label: 'ID verifications', sub: 'Renters waiting for review', n: a.verifications },
    { to: '/admin/listings', icon: Car, label: 'Vehicle listings', sub: 'Submitted by hosts', n: a.listings },
    { to: '/admin/host-applications', icon: Store, label: 'Host applications', sub: 'People who want to host', n: a.host_applications },
    { to: '/admin/disputes', icon: Gavel, label: 'Open disputes', sub: 'Damage, theft and incidents', n: a.disputes },
    { to: '/admin/payouts', icon: Banknote, label: 'Payouts due', sub: 'Host earnings to send', n: a.payouts },
    { to: '/admin/support', icon: Headset, label: 'Support messages', sub: 'Waiting for a reply', n: a.support },
  ]
  const urgent = items.reduce((s, i) => s + i.n, 0)
  const last = data.months[data.months.length - 1]
  return (
    <section className="mb-5 grid gap-5 xl:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader title={`${compactPeso(last?.amount ?? 0)} booked in ${new Date().toLocaleDateString('en-PH', { month: 'long' })}`} description="Gross booking value, last 12 months" />
        <CardBody><BarChart data={data.months} height={220} /></CardBody>
      </Card>
      <Card>
        <CardHeader title="Needs attention" description="Items waiting on an admin decision" action={urgent > 0 && <Badge tone="danger">{urgent} waiting</Badge>} />
        <ul className="divide-y divide-line-100">
          {items.map((i) => (
            <li key={i.to}>
              <Link to={i.to} className="flex items-center gap-3 px-5 py-3 hover:bg-page">
                <span className="flex size-9 items-center justify-center rounded-xl bg-accent-soft text-warning"><i.icon className="size-4.5" /></span>
                <span className="flex-1"><span className="block text-sm font-semibold">{i.label}</span><span className="block text-xs text-ink-500">{i.sub}</span></span>
                <span className={cn('text-sm font-bold', i.n === 0 && 'text-ink-400')}>{i.n}</span>
                <ChevronRight className="size-4 text-ink-400" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  )
}

export function BookingsTable({ rows, empty }: { rows: BookingRow[]; empty?: React.ReactNode }) {
  const navigate = useNavigate()
  return (
    <Table<BookingRow>
      rows={rows}
      rowKey={(b) => b.id}
      onRowClick={(b) => navigate(`/admin/bookings/${b.reference}`)}
      empty={empty}
      columns={[
        { key: 'ref', header: 'Booking', cell: (b) => <span className="font-semibold">{b.reference}</span> },
        { key: 'renter', header: 'Renter', cell: (b) => <div className="flex items-center gap-2.5"><Avatar initials={b.renter?.initials ?? '?'} size="sm" seed={b.renter?.id} /><div className="min-w-0"><p className="truncate font-medium">{b.renter?.name}</p><p className="truncate text-xs text-ink-500">{b.renter?.email}</p></div></div> },
        { key: 'vehicle', header: 'Vehicle', cell: (b) => <><p className="font-medium">{b.vehicle?.name}</p><p className="text-xs text-ink-500">Host · {b.host?.name}</p></> },
        { key: 'trip', header: 'Trip', cell: (b) => <><p className="whitespace-nowrap">{formatRange(b.pickup_at, b.return_at)}</p><p className="text-xs text-ink-500">{b.pickup_label.split(',').slice(-1)[0]}</p></> },
        { key: 'total', header: 'Total', cell: (b) => <span className="font-semibold">{peso(b.total)}</span> },
        { key: 'payment', header: 'Payment', cell: (b) => <StatusBadge status={b.payment_status} /> },
        { key: 'status', header: 'Status', cell: (b) => <div className="flex flex-col items-start gap-1"><StatusBadge status={tripStatus(b)} />{b.has_open_incident && <Badge tone="danger">Disputed</Badge>}</div> },
      ]}
    />
  )
}

export function AdminRecentBookingsSection() {
  const { data } = useOverview()
  if (!data) return null
  return (
    <Card>
      <CardHeader title="Recent bookings" action={<Link to="/admin/bookings" className="inline-flex items-center gap-1 text-sm font-semibold text-brand">View all bookings <ArrowRight className="size-4" /></Link>} />
      <BookingsTable rows={data.recent} />
    </Card>
  )
}
