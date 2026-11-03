import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { localToIso } from '@/lib/format'
import type { VehicleFilters } from '@/services/vehicles'

export const FILTER_KEYS = ['type', 'transmission', 'fuel', 'seats', 'price_min', 'price_max', 'rental_type', 'instant_book', 'delivery', 'pet_friendly'] as const

/** Search + filter state lives in the URL so results are shareable and survive refresh. */
export function useVehicleSearch() {
  const [params, setParams] = useSearchParams()

  const get = useCallback((k: string) => params.get(k) ?? '', [params])

  const set = useCallback(
    (updates: Record<string, string | number | boolean | null | undefined>, keepPage = false) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(updates)) {
            if (v === null || v === undefined || v === '' || v === false) next.delete(k)
            else next.set(k, String(v))
          }
          if (!keepPage) next.delete('page')
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const clearFilters = useCallback(() => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      FILTER_KEYS.forEach((k) => next.delete(k))
      next.delete('page')
      return next
    })
  }, [setParams])

  const apiFilters = useMemo<VehicleFilters>(() => {
    const pickup = get('pickup')
    const ret = get('return')
    const f: VehicleFilters = {
      location: get('location'),
      q: get('q'),
      sort: get('sort') || 'recommended',
      page: get('page') || 1,
      lat: get('lat'),
      lng: get('lng'),
    }
    FILTER_KEYS.forEach((k) => (f[k] = get(k)))
    if (pickup && ret && new Date(ret) > new Date(pickup)) {
      f.pickup_at = localToIso(pickup)
      f.return_at = localToIso(ret)
    }
    return f
  }, [get])

  const activeCount = FILTER_KEYS.filter((k) => params.get(k)).length
  /** Query string to carry the chosen dates over to the vehicle page. */
  const tripQuery = useMemo(() => {
    const q = new URLSearchParams()
    if (params.get('pickup')) q.set('pickup', params.get('pickup')!)
    if (params.get('return')) q.set('return', params.get('return')!)
    if (params.get('rental_type') === 'driver') q.set('type', 'driver')
    const s = q.toString()
    return s ? `?${s}` : ''
  }, [params])

  return { params, get, set, clearFilters, apiFilters, activeCount, tripQuery }
}
