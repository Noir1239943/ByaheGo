import { useState } from 'react'
import { Link } from 'react-router'
import { CalendarCheck, Car, Check, ChevronRight, Star, Wallet } from 'lucide-react'
import { StatCard } from '@/components/common/StatCard'
import { ErrorState, ListSkeleton } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { tripStatus } from '@/lib/status'
import { VehicleArt } from '@/components/common/VehicleArt'
import { VehicleImage } from '@/components/common/VehicleImage'
import { Button, Card, CardHeader, EmptyState, ProgressBar } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/cn'
import { formatDateTime, peso } from '@/lib/format'
import { PayoutAccountModal } from './PayoutAccountModal'
import { useHostDashboard } from './useHostDashboard'


function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export function HostWelcomeSection() {
  const { user } = useAuth()
  return (
    <section className="mb-6">
      <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{greeting()}, {user?.name.split(' ')[0]}</h2>
      <p className="mt-1 text-sm text-ink-500">Here's what's happening with your vehicles today.</p>
    </section>
  )
}

export function HostSetupSection() {
  const { data } = useHostDashboard()
  const [payoutOpen, setPayoutOpen] = useState(false)
  if (!data) return null
  const s = data.setup
  const steps = [
    { done: s.account, t: 'Create your host account', sub: 'You\'re in. Welcome aboard!' },
    { done: s.identity, t: 'Verify your identity', sub: 'Upload your ID and driver\'s license', action: <Link to="/verify" className="text-sm font-semibold text-brand">Verify</Link> },
    { done: s.payout, t: 'Add a payout account', sub: 'GCash, Maya or bank', action: <button onClick={() => setPayoutOpen(true)} className="text-sm font-semibold text-brand">Add</button> },
    { done: s.vehicle, t: 'List your first vehicle', sub: 'Photos, daily rate and pick-up spot', action: <Link to="/host/vehicles/new" className="text-sm font-semibold text-brand">Start</Link> },
  ]
  const done = steps.filter((x) => x.done).length
  if (done === steps.length) return null
  return (
    <section className="mb-6">
      <Card className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="text-xs font-bold tracking-wider text-brand uppercase">Host setup</p>
          <h3 className="mt-1 text-lg font-bold">Finish these steps to start earning</h3>
          <div className="mt-3 flex items-center gap-3 text-sm"><ProgressBar value={(done / steps.length) * 100} /><span className="font-semibold whitespace-nowrap">{done} of {steps.length}</span></div>
          <ul className="mt-4 divide-y divide-line-100">
            {steps.map((st) => (
              <li key={st.t} className="flex items-center gap-3 py-3">
                <span className={cn('flex size-6 items-center justify-center rounded-full', st.done ? 'bg-brand text-white' : 'border-2 border-line-200')}>{st.done && <Check className="size-3.5" strokeWidth={3} />}</span>
                <div className="flex-1"><p className={cn('text-sm font-semibold', st.done && 'text-ink-500 line-through')}>{st.t}</p><p className="text-xs text-ink-500">{st.sub}</p></div>
                {st.done ? <span className="text-xs font-semibold text-success">Done</span> : st.action}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl bg-brand-tint p-6 text-center">
          <VehicleArt type="sedan" color="#FFB224" className="w-44" />
          <p className="mt-3 font-bold">Your car can earn while you're not using it</p>
          <p className="mt-1 text-sm text-ink-500">Set your own price and schedule, and approve every booking.</p>
          <Button className="mt-4" to="/host/vehicles/new">Add your first vehicle</Button>
        </div>
      </Card>
      <PayoutAccountModal open={payoutOpen} onClose={() => setPayoutOpen(false)} />
    </section>
  )
}

export function HostStatsSection() {
  const { data, isLoading, error, refetch } = useHostDashboard()
  if (isLoading) return <ListSkeleton rows={1} />
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />
  const s = data.stats
  return (
    <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard icon={<Wallet />} label="Earnings this month" value={peso(s.earnings_this_month)} sub={`${peso(s.pending_payouts)} scheduled to be paid`} />
      <StatCard icon={<CalendarCheck />} label="Upcoming bookings" value={s.upcoming_bookings} sub={`${s.active_trips} on a trip now`} tone="info" />
      <StatCard icon={<Car />} label="Active listings" value={s.live_listings} sub={`${s.total_listings} vehicles in total`} />
      <StatCard icon={<Star />} label="Host rating" value={s.rating ? s.rating.toFixed(1) : '—'} sub={s.reviews ? `${s.reviews} reviews` : 'No reviews yet'} tone="accent" />
    </section>
  )
}

export function HostTodaySection() {
  const { data } = useHostDashboard()
  if (!data) return null
  return (
    <section className="grid gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader title="Handovers coming up" description="Pick-ups and returns in the next 2 days" action={<Button size="sm" variant="ghost" to="/host/bookings">All bookings</Button>} />
        {data.today.length === 0 ? (
          <EmptyState icon={<CalendarCheck />} title="Nothing scheduled" description="Upcoming pick-ups and returns show up here." />
        ) : (
          <ul className="divide-y divide-line-100">
            {data.today.map((b) => (
              <li key={b.id}>
                <Link to={`/host/bookings/${b.reference}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-page">
                  <div className="h-11 w-16 shrink-0 overflow-hidden rounded-lg">{b.vehicle && <VehicleImage photo={b.vehicle.photo} type={b.vehicle.type} color={b.vehicle.color_hex} alt="" />}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{b.status === 'active' ? 'Return' : 'Pick-up'} · {b.vehicle?.make} {b.vehicle?.model}</p>
                    <p className="text-xs text-ink-500">{b.renter?.name} · {formatDateTime(b.status === 'active' ? b.return_at : b.pickup_at)}</p>
                  </div>
                  <ChevronRight className="size-4 text-ink-400" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <CardHeader title="Recent bookings" />
        {data.recent.length === 0 ? (
          <EmptyState icon={<CalendarCheck />} title="No bookings yet" description="When renters book your vehicles, they show up here." />
        ) : (
          <ul className="divide-y divide-line-100">
            {data.recent.map((b) => (
              <li key={b.id}>
                <Link to={`/host/bookings/${b.reference}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-page">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{b.renter?.name} <span className="font-normal text-ink-500">· {b.reference}</span></p>
                    <p className="truncate text-xs text-ink-500">{b.vehicle?.name}</p>
                  </div>
                  <div className="text-right"><StatusBadge status={tripStatus(b)} /><p className="mt-1 text-xs font-semibold">{peso(b.host_earnings)}</p></div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  )
}
