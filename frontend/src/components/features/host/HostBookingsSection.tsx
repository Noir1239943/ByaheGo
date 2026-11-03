import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { CalendarCheck, Search } from 'lucide-react'
import { ErrorState, ListSkeleton } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { tripStatus } from '@/lib/status'
import { Alert, Avatar, Button, Card, EmptyState, Input, Table, Tabs } from '@/components/ui'
import { useDebounce } from '@/hooks/useDebounce'
import { formatRange, peso } from '@/lib/format'
import { hostService } from '@/services/host'
import type { BookingRow } from '@/types'

type Tab = 'upcoming' | 'on_trip' | 'completed' | 'cancelled'

export function HostBookingsSection() {
  const [tab, setTab] = useState<Tab>('upcoming')
  const [q, setQ] = useState('')
  const dq = useDebounce(q)
  const navigate = useNavigate()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['host', 'bookings', tab, dq], queryFn: () => hostService.bookings({ tab, q: dq || undefined }) })
  const c = data?.counts
  return (
    <section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'upcoming', label: 'Upcoming', count: c?.upcoming }, { value: 'on_trip', label: 'On trip', count: c?.on_trip }, { value: 'completed', label: 'Completed', count: c?.completed }, { value: 'cancelled', label: 'Cancelled', count: c?.cancelled }]} />
        <Input placeholder="Search renter or booking ID" leftIcon={<Search />} value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-64" aria-label="Search bookings" />
      </div>
      {tab === 'upcoming' && <Alert tone="brand" className="mb-4">Start the handover from a booking on pick-up day: walk around the vehicle with the renter and record the checklist together.</Alert>}
      <Card>
        {isLoading ? <div className="p-5"><ListSkeleton /></div> : error ? <ErrorState error={error} onRetry={() => void refetch()} /> : (
          <Table<BookingRow>
            rows={data!.data}
            rowKey={(b) => b.id}
            onRowClick={(b) => navigate(`/host/bookings/${b.reference}`)}
            empty={<EmptyState icon={<CalendarCheck />} title="No bookings yet" description="When renters book your vehicles, their requests and trips show up here." action={<Button variant="secondary" to="/host/vehicles">View your vehicles</Button>} />}
            columns={[
              { key: 'renter', header: 'Renter', cell: (b) => <div className="flex items-center gap-3"><Avatar initials={b.renter?.initials ?? '?'} size="sm" seed={b.renter?.id} /><div><p className="font-semibold">{b.renter?.name}</p><p className="text-xs text-ink-500">{b.reference}</p></div></div> },
              { key: 'vehicle', header: 'Vehicle', cell: (b) => <span className="font-medium">{b.vehicle?.name}</span> },
              { key: 'dates', header: 'Trip dates', cell: (b) => <span className="whitespace-nowrap text-ink-700">{formatRange(b.pickup_at, b.return_at)}<span className="block text-xs text-ink-400">{b.days} day(s) · {b.rental_type === 'driver' ? 'with driver' : 'self-drive'}</span></span> },
              { key: 'status', header: 'Status', cell: (b) => <div className="flex flex-col items-start gap-1"><StatusBadge status={tripStatus(b)} />{b.has_open_incident && <span className="text-[11px] font-semibold text-danger">Open report</span>}</div> },
              { key: 'payout', header: 'Your payout', headerClassName: 'text-right', className: 'text-right', cell: (b) => <span className="font-bold">{b.status === 'cancelled' ? '—' : peso(b.host_earnings)}</span> },
            ]}
          />
        )}
      </Card>
    </section>
  )
}
