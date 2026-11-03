import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { LocateFixed, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, Button, Input, Skeleton } from '@/components/ui'
import { useDebounce } from '@/hooks/useDebounce'
import { useGeolocation } from '@/hooks/useGeolocation'
import { areaCenter } from '@/lib/areas'
import { reversePlace, searchPlaces, type Place, type Resolved } from '@/lib/nominatim'

const PinPicker = lazy(() => import('@/components/common/PinPicker'))

type Props = {
  lat: number | null
  lng: number | null
  city: string
  error?: string
  /** Called whenever the pin moves. `place` is the readable area/city worked out for it, if the lookup worked. */
  onChange: (lat: number, lng: number, place: Resolved | null) => void
}

/** Drop a pin on the map, search an address, or use the current location. */
export function PickupPinField({ lat, lng, city, error, onChange }: Props) {
  const [query, setQuery] = useState('')
  const debounced = useDebounce(query, 800)
  const [found, setFound] = useState<{ q: string; rows: Place[] } | null>(null)
  const geo = useGeolocation()
  const seq = useRef(0)
  const wanted = debounced.trim().length >= 3 && query.trim().length > 0
  const searching = wanted && found?.q !== debounced
  const visible = wanted && found?.q === debounced ? found.rows : []
  const pin = lat !== null && lng !== null ? { lat, lng } : null

  useEffect(() => {
    if (debounced.trim().length < 3) return
    const ctrl = new AbortController()
    searchPlaces(debounced, ctrl.signal)
      .then((rows) => { setFound({ q: debounced, rows }); if (rows.length === 0) toast.message('No match. Try a landmark or a barangay, or tap the map.') })
      .catch((e) => { if (e?.name !== 'AbortError') { setFound({ q: debounced, rows: [] }); toast.error(e instanceof Error ? e.message : 'Address search failed.') } })
    return () => ctrl.abort()
  }, [debounced])

  const place = async (la: number, ln: number) => {
    const mine = ++seq.current
    let resolved: Resolved | null = null
    try { resolved = await reversePlace(la, ln) } catch { /* the pin still counts; the host can type the area */ }
    if (mine === seq.current) onChange(la, ln, resolved)
  }

  const pick = (p: Place) => { setFound(null); setQuery(''); void place(p.lat, p.lng) }

  return (
    <div className="space-y-3 sm:col-span-2">
      <div className="relative">
        <Input label="Search an address or landmark" leftIcon={<Search className="size-4" />} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Gaisano Mactan, Pusok" hint={searching ? 'Searching…' : 'Or tap the map / drag the pin to the exact spot.'} />
        {visible.length > 0 && (
          <ul className="absolute inset-x-0 top-full z-[500] mt-1 max-h-60 overflow-y-auto rounded-xl border border-line-200 bg-white py-1 shadow-pop">
            {visible.map((r) => (
              <li key={`${r.lat},${r.lng}`}>
                <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-brand-tint" onClick={() => pick(r)}>{r.label}</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={geo.loading}
          icon={<LocateFixed className="size-4" />}
          onClick={async () => {
            const c = await geo.request()
            if (c) void place(c.lat, c.lng)
            else toast.error('We couldn\'t get your location. Search an address or tap the map instead.')
          }}
        >
          Use my current location
        </Button>
        <span className="text-xs text-ink-500">{pin ? `Pin set at ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}` : 'No pin yet'}</span>
      </div>
      <div className={`overflow-hidden rounded-2xl border ${error ? 'border-danger' : 'border-line-200'}`}>
        <Suspense fallback={<Skeleton className="h-72 w-full rounded-none" />}>
          <PinPicker pin={pin} center={areaCenter(city)} onPick={(p) => void place(p.lat, p.lng)} className="h-72 w-full" />
        </Suspense>
      </div>
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
      <Alert tone="brand" title="Renters never see the exact pin">Before booking, renters only see your barangay and a spot rounded to about 1 km. The exact pin and address are shared once their booking is confirmed.</Alert>
    </div>
  )
}
