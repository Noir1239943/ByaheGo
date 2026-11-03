import { lazy, Suspense, useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { LayoutGrid, List, LocateFixed, Map as MapIcon, Radio } from 'lucide-react'
import { toast } from 'sonner'
import { VehicleCard } from '@/components/common/VehicleCard'
import { Button, Chip, EmptyState, Skeleton } from '@/components/ui'
import { useGeolocation } from '@/hooks/useGeolocation'
import { cn } from '@/lib/cn'
import { VEHICLE_TYPES } from '@/lib/constants'
import { formatRange, timeAgo } from '@/lib/format'
import { vehicleService } from '@/services/vehicles'
import { useVehicleSearch } from './useVehicleSearch'

const MapView = lazy(() => import('@/components/common/MapView'))

export function LiveMapSection() {
  const { get, set, apiFilters, tripQuery, params } = useVehicleSearch()
  const [active, setActive] = useState<number | null>(null)
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map')
  const [, tick] = useState(0)
  const geo = useGeolocation()

  // Real-time: the map refreshes every 15 seconds so availability stays current.
  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['vehicles', 'map', apiFilters],
    queryFn: () => vehicleService.map(apiFilters),
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
    placeholderData: keepPreviousData,
  })
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 5000)
    return () => window.clearInterval(id)
  }, [])

  const types = get('type') ? get('type').split(',') : []
  const vehicles = data?.data ?? []
  const listed = [...vehicles].sort((a, b) => (a.availability === 'available' ? 0 : 1) - (b.availability === 'available' ? 0 : 1))
  const hasDates = !!apiFilters.pickup_at

  return (
    <section className="container-page py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Live availability map</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-500">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">
              <Radio className="size-3.5 animate-pulse" /> Live
            </span>
            Updated {timeAgo(new Date(dataUpdatedAt || Date.now()).toISOString())}
            {hasDates && <span>· showing availability for {formatRange(get('pickup'), get('return'))}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={geo.loading}
            icon={<LocateFixed className="size-4" />}
            onClick={async () => {
              const c = await geo.request()
              if (!c) toast.error('Allow location access to see cars near you.')
            }}
          >
            Near me
          </Button>
          <Link to={`/vehicles?${params.toString()}`} className="hidden h-9 items-center gap-1.5 rounded-lg border border-line-200 bg-white px-3 text-sm font-semibold hover:bg-page sm:flex">
            <LayoutGrid className="size-4" /> Grid view
          </Link>
        </div>
      </div>

      <div className="scrollbar-none mb-4 flex items-center gap-2 overflow-x-auto">
        {VEHICLE_TYPES.map((t) => (
          <Chip key={t.value} active={types.includes(t.value)} showCheck onClick={() => set({ type: (types.includes(t.value) ? types.filter((x) => x !== t.value) : [...types, t.value]).join(',') })}>
            {t.plural}
          </Chip>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs font-semibold text-ink-700">
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-brand" /> Available ({data?.counts.available ?? 0})</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-accent" /> On a trip now ({data?.counts.on_trip ?? 0})</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-danger" /> Booked{hasDates ? ' for your dates' : ''} ({data?.counts.booked ?? 0})</span>
        <div className="ml-auto flex rounded-lg border border-line-200 bg-white p-0.5 lg:hidden">
          <button onClick={() => setMobileView('map')} className={cn('flex h-8 items-center gap-1 rounded-md px-3', mobileView === 'map' && 'bg-ink-900 text-white')}><MapIcon className="size-3.5" /> Map</button>
          <button onClick={() => setMobileView('list')} className={cn('flex h-8 items-center gap-1 rounded-md px-3', mobileView === 'list' && 'bg-ink-900 text-white')}><List className="size-3.5" /> List</button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <div className={cn('space-y-4 lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto lg:pr-1', mobileView === 'map' && 'hidden lg:block')}>
          {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-72" />)}
          {!isLoading && listed.length === 0 && <EmptyState title="No vehicles match" description="Try another vehicle type." />}
          {listed.map((v) => (
            <div key={v.id} className="relative">
              {v.availability !== 'available' && (
                <span className={cn('absolute top-3 left-1/2 z-[2] -translate-x-1/2 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm', v.availability === 'booked' ? 'bg-danger text-white' : 'bg-accent text-ink-900')}>
                  {v.availability === 'booked' ? 'Booked' : 'On a trip now'}
                </span>
              )}
              <VehicleCard vehicle={v} compact query={tripQuery} highlight={active === v.id} onHover={setActive} className={v.availability === 'booked' ? 'opacity-70' : ''} />
            </div>
          ))}
        </div>
        <div className={cn('h-[70vh] overflow-hidden rounded-2xl border border-line-200 bg-white shadow-card lg:h-[calc(100vh-14rem)]', mobileView === 'list' && 'hidden lg:block')}>
          <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
            <MapView vehicles={vehicles} activeId={active} onSelect={setActive} className="h-full w-full" query={tripQuery} me={geo.coords} />
          </Suspense>
        </div>
      </div>
    </section>
  )
}
