import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { CalendarSearch, Search } from 'lucide-react'
import { ErrorState, ListSkeleton } from '@/components/common/States'
import { Card, EmptyState, Input, Pagination, Tabs } from '@/components/ui'
import { useDebounce } from '@/hooks/useDebounce'
import { adminService } from '@/services/admin'
import { BookingsTable } from './AdminOverviewSections'
import { useState } from 'react'

export function AdminBookingsSection() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? 'all'
  const page = Number(params.get('page') ?? 1)
  const [q, setQ] = useState(params.get('q') ?? '')
  const dq = useDebounce(q)
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'bookings', status, page, dq], queryFn: () => adminService.bookings({ status, page, q: dq || undefined }), placeholderData: keepPreviousData })
  const c = data?.counts
  const s = data?.summary
  return (
    <section>
      {s && (
        <Card className="mb-5 grid divide-y divide-line-100 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          {[['Bookings this month', s.this_month], ['Active right now', s.active_now], ['Upcoming (7 days)', s.upcoming_week], ['Cancellation rate', `${s.cancellation_rate}%`]].map(([l, v]) => (
            <div key={l} className="p-5"><p className="text-xs text-ink-500">{l}</p><p className="mt-1 text-2xl font-extrabold">{v}</p></div>
          ))}
        </Card>
      )}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs variant="pill" value={status} onChange={(v) => setParams({ status: v })} tabs={[
          { value: 'all', label: 'All', count: c?.all }, { value: 'upcoming', label: 'Upcoming', count: c?.upcoming }, { value: 'active', label: 'Active', count: c?.active },
          { value: 'completed', label: 'Completed', count: c?.completed }, { value: 'cancelled', label: 'Cancelled', count: c?.cancelled }, { value: 'disputed', label: 'Disputed', count: c?.disputed },
        ]} />
        <Input placeholder="Search booking ID, renter or plate" leftIcon={<Search />} value={q} onChange={(e) => { setQ(e.target.value); setParams((p) => { p.delete('page'); return p }) }} className="h-9 w-72" aria-label="Search bookings" />
      </div>
      <Card>
        {isLoading ? <div className="p-5"><ListSkeleton /></div> : error ? <ErrorState error={error} onRetry={() => void refetch()} /> : (
          <>
            <BookingsTable rows={data!.data} empty={<EmptyState icon={<CalendarSearch />} title="No bookings found" description="Try another filter or search term." />} />
            <div className="border-t border-line-100 p-4"><Pagination meta={data!.meta} label="bookings" onChange={(p) => setParams((prev) => { prev.set('page', String(p)); return prev })} /></div>
          </>
        )}
      </Card>
    </section>
  )
}
