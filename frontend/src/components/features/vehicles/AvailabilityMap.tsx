import { lazy, Suspense, useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { List, Map as MapIcon, RefreshCw, Radio } from 'lucide-react'
import { VehicleCard } from '@/components/common/VehicleCard'
import { ErrorState } from '@/components/common/States'
import { EmptyState, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatRange, timeAgo } from '@/lib/format'
import { vehicleService } from '@/services/vehicles'
import { useVehicleSearch } from './useVehicleSearch'

const MapView = lazy(() => import('@/components/common/MapView'))

/** How often the map re-asks the server. Near real-time without websockets (see the README on Laravel Reverb). */
export const MAP_REFRESH_MS = 30_000

/**
 * The map side of the List ⇄ Map toggle. It uses the exact same filters and dates as the list.
 * While the browser tab is hidden it stops polling, and refreshes as soon as the tab is shown again.
 */
export function AvailabilityMap() {
  const { get, apiFilters, tripQuery } = useVehicleSearch()
  const [active, setActive] = useState<number | null>(null)
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map')
  const [, tick] = useState(0)

  // Sorting and paging belong to the list. The map always shows every match.
  const filters = { ...apiFilters, page: undefined, sort: undefined }
  const { data, isLoading, error, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['vehicles', 'map', filters],
    queryFn: () => vehicleService.map(filters),
    refetchInterval: MAP_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  })
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 5000)
    return () => window.clearInterval(id)
  }, [])

  if (error && !data) return <ErrorState error={error} onRetry={() => void refetch()} />

  const vehicles = data?.data ?? []
  const listed = [...vehicles].sort((a, b) => (a.availability === 'available' ? 0 : 1) - (b.availability === 'available' ? 0 : 1))
  const hasDates = !!apiFilters.pickup_at
  const near = apiFilters.lat && apiFilters.lng ? { lat: Number(apiFilters.lat), lng: Number(apiFilters.lng) } : null

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-ink-700">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2 py-0.5 text-success">
          <Radio className={cn('size-3.5', !isFetching && 'animate-pulse')} /> Live
        </span>
        <span className="font-normal text-ink-500">
          Updated {timeAgo(new Date(dataUpdatedAt || Date.now()).toISOString())}
          {hasDates && <> · availability for {formatRange(get('pickup'), get('return'))}</>}
        </span>
        <button onClick={() => void refetch()} className="inline-flex items-center gap-1 text-brand hover:underline" aria-label="Refresh the map now">
          <RefreshCw className={cn('size-3.5', isFetching && 'animate-spin')} /> Refresh
        </button>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-brand" /> Available ({data?.counts.available ?? 0})</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-accent" /> On a trip now ({data?.counts.on_trip ?? 0})</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-danger" /> Unavailable{hasDates ? ' for your dates' : ''} ({data?.counts.booked ?? 0})</span>
        <div className="ml-auto flex rounded-lg border border-line-200 bg-white p-0.5 lg:hidden">
          <button onClick={() => setMobileView('map')} className={cn('flex h-8 items-center gap-1 rounded-md px-3', mobileView === 'map' && 'bg-ink-900 text-white')}><MapIcon className="size-3.5" /> Map</button>
          <button onClick={() => setMobileView('list')} className={cn('flex h-8 items-center gap-1 rounded-md px-3', mobileView === 'list' && 'bg-ink-900 text-white')}><List className="size-3.5" /> Cards</button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
        <div className={cn('space-y-4 xl:max-h-[calc(100vh-14rem)] xl:overflow-y-auto xl:pr-1', mobileView === 'map' && 'hidden xl:block')}>
          {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-72" />)}
          {!isLoading && listed.length === 0 && <EmptyState title="No vehicles match" description="Try a bigger radius or fewer filters." />}
          {listed.map((v) => (
            <div key={v.id} className="relative">
              {v.availability !== 'available' && (
                <span className={cn('absolute top-3 left-1/2 z-[2] -translate-x-1/2 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm', v.availability === 'booked' ? 'bg-danger text-white' : 'bg-accent text-ink-900')}>
                  {v.availability === 'booked' ? 'Unavailable' : 'On a trip now'}
                </span>
              )}
              <VehicleCard vehicle={v} compact query={tripQuery} highlight={active === v.id} onHover={setActive} className={v.availability === 'booked' ? 'opacity-70' : ''} />
            </div>
          ))}
        </div>
        <div className={cn('h-[70vh] overflow-hidden rounded-2xl border border-line-200 bg-white shadow-card xl:h-[calc(100vh-14rem)]', mobileView === 'list' && 'hidden xl:block')}>
          <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
            <MapView vehicles={vehicles} activeId={active} onSelect={setActive} className="h-full w-full" query={tripQuery} me={near} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
