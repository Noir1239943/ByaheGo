import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowDownUp, CalendarDays, LayoutGrid, Map, SearchX, SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { CardGridSkeleton, ErrorState } from '@/components/common/States'
import { VehicleCard } from '@/components/common/VehicleCard'
import { Button, Drawer, EmptyState, Pagination, Select } from '@/components/ui'
import { useGeolocation } from '@/hooks/useGeolocation'
import { cn } from '@/lib/cn'
import { formatRange, plural } from '@/lib/format'
import { vehicleService } from '@/services/vehicles'
import { FiltersPanel } from './FiltersPanel'
import { AvailabilityMap } from './AvailabilityMap'
import { useVehicleSearch } from './useVehicleSearch'

const SORTS = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'nearest', label: 'Nearest to me' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
  { value: 'newest', label: 'Newest listings' },
]

export function BrowseSection() {
  const { get, set, apiFilters, activeCount, clearFilters, tripQuery } = useVehicleSearch()
  const view = get('view') === 'map' ? 'map' : 'list'
  const [filtersOpen, setFiltersOpen] = useState(false)
  const geo = useGeolocation()

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['vehicles', apiFilters],
    queryFn: () => vehicleService.list(apiFilters),
    placeholderData: keepPreviousData,
    enabled: view === 'list', // the map asks for its own data
  })

  const changeSort = async (sort: string) => {
    if (sort === 'nearest') {
      const c = await geo.request()
      if (!c) {
        toast.error('Allow location access to sort by distance, or choose a city in the search bar.')
        return
      }
      set({ sort, lat: c.lat.toFixed(5), lng: c.lng.toFixed(5), place: 'My location', radius: get('radius') || null })
      return
    }
    set({ sort })
  }

  const location = get('location')
  const hasDates = !!apiFilters.pickup_at
  const sort = apiFilters.sort as string
  // Sorting now lives inside the Filters panel, so say in the header when it isn't the default.
  const sortLabel = sort === 'nearest' ? 'Nearest first' : SORTS.find((s) => s.value === sort)?.label

  return (
    <section className="container-page py-6 lg:py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {location ? `Vehicles in ${location}` : 'Vehicles across Cebu'}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-ink-500">
            {view === 'map' ? (hasDates ? 'Live availability for your dates' : 'Live availability right now') : data ? `${plural(data.meta.total, 'vehicle')} ${hasDates ? 'free for your dates' : 'available'}` : 'Finding vehicles…'}
            {hasDates && (
              <span className="inline-flex items-center gap-1 font-medium text-ink-700">
                <CalendarDays className="size-3.5" /> {formatRange(get('pickup'), get('return'))}
              </span>
            )}
            {view === 'list' && sort !== 'recommended' && sortLabel && (
              <span className="inline-flex items-center gap-1 font-medium text-ink-700">
                <ArrowDownUp className="size-3.5" /> {sortLabel}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" aria-haspopup="dialog" icon={<SlidersHorizontal className="size-4" />} onClick={() => setFiltersOpen(true)}>
            Filters
            {activeCount > 0 && (
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-brand text-[11px] leading-none font-bold text-white">
                {activeCount}
                <span className="sr-only"> on</span>
              </span>
            )}
          </Button>
          <div className="flex rounded-lg border border-line-200 bg-white p-0.5" role="group" aria-label="Show as list or map">
            {([['list', LayoutGrid, 'List'], ['map', Map, 'Map']] as const).map(([v, Icon, label]) => (
              <button
                key={v}
                aria-pressed={view === v}
                onClick={() => set({ view: v === 'map' ? 'map' : null }, true)}
                className={cn('flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold', view === v ? 'bg-ink-900 text-white' : 'text-ink-700 hover:bg-line-100')}
              >
                <Icon className="size-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === 'map' ? (
        <AvailabilityMap />
      ) : isLoading ? (
        <CardGridSkeleton count={12} className="lg:grid-cols-3 xl:grid-cols-4" />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : data && data.data.length === 0 ? (
        <div className="rounded-2xl border border-line-200 bg-white">
          <EmptyState
            icon={<SearchX />}
            title="No vehicles match your search"
            description={hasDates ? 'Everything that fits is booked for those dates. Try different dates, a nearby city, or fewer filters.' : 'Try removing a filter or searching another city.'}
            action={
              <>
                {activeCount > 0 && (
                  <Button variant="secondary" onClick={clearFilters}>
                    Clear filters
                  </Button>
                )}
                <Button to="/vehicles">See all vehicles</Button>
              </>
            }
          />
        </div>
      ) : (
        <div className={isFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data?.data.map((v) => <VehicleCard key={v.id} vehicle={v} query={tripQuery} />)}
          </div>
          {data && (
            <Pagination
              className="mt-8"
              meta={data.meta}
              label="vehicles"
              onChange={(p) => {
                set({ page: p }, true)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            />
          )}
        </div>
      )}

      <Drawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        side="right"
        title={view === 'list' ? 'Sort & filter' : 'Filters'}
        footer={
          <Button fullWidth onClick={() => setFiltersOpen(false)}>
            {view === 'map' ? 'Show on map' : `Show ${data ? plural(data.meta.total, 'vehicle') : 'vehicles'}`}
          </Button>
        }
      >
        <div className="p-5">
          {view === 'list' && (
            <div className="mb-6 border-b border-line-100 pb-6">
              <p className="mb-2 text-sm font-semibold">Sort by</p>
              <Select aria-label="Sort vehicles" value={sort} onChange={(e) => void changeSort(e.target.value)} options={SORTS} className="h-10 rounded-xl text-sm" />
            </div>
          )}
          <FiltersPanel facets={data?.facets.types} />
        </div>
      </Drawer>
    </section>
  )
}
