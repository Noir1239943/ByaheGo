/**
 * OpenStreetMap Nominatim client that follows https://operations.osmfoundation.org/policies/nominatim/ :
 * at most one request per second (a shared queue), results cached, searches debounced by the caller,
 * limited to the Philippines, and the browser sends our site as the Referer. No autocomplete-per-keystroke.
 * Set VITE_NOMINATIM_EMAIL to a contact address so OSM can reach us if something misbehaves.
 */
const BASE = 'https://nominatim.openstreetmap.org'
const EMAIL = import.meta.env.VITE_NOMINATIM_EMAIL as string | undefined

export type Place = { lat: number; lng: number; label: string }
export type Resolved = { area: string | null; city: string | null; street: string | null; label: string }

let last = 0
let chain: Promise<unknown> = Promise.resolve()
const cache = new Map<string, unknown>()

function throttled<T>(key: string, url: string, signal?: AbortSignal): Promise<T> {
  if (cache.has(key)) return Promise.resolve(cache.get(key) as T)
  const run = async () => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const wait = Math.max(0, last + 1100 - Date.now())
    if (wait) await new Promise((r) => setTimeout(r, wait))
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    last = Date.now()
    const res = await fetch(url + (EMAIL ? `&email=${encodeURIComponent(EMAIL)}` : ''), { signal, headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`Map search is busy (${res.status}). Try again in a moment.`)
    const json = (await res.json()) as T
    cache.set(key, json)
    return json
  }
  const next = chain.then(run, run)
  chain = next.catch(() => undefined)
  return next
}

type SearchRow = { lat: string; lon: string; display_name: string }
type ReverseRow = { display_name?: string; address?: Record<string, string> }

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim()
  if (q.length < 3) return []
  const rows = await throttled<SearchRow[]>(`s:${q.toLowerCase()}`, `${BASE}/search?format=jsonv2&countrycodes=ph&limit=5&addressdetails=0&viewbox=123.2,11.4,124.2,9.4&q=${encodeURIComponent(q)}`, signal)
  return rows.map((r) => ({ lat: Number(r.lat), lng: Number(r.lon), label: r.display_name.split(',').slice(0, 4).join(',') }))
}

/** Turns a pin into a readable barangay/city so listings can show an area instead of an address. */
export async function reversePlace(lat: number, lng: number, signal?: AbortSignal): Promise<Resolved> {
  const key = `r:${lat.toFixed(4)},${lng.toFixed(4)}`
  const row = await throttled<ReverseRow>(key, `${BASE}/reverse?format=jsonv2&zoom=17&addressdetails=1&lat=${lat}&lon=${lng}`, signal)
  const a = row.address ?? {}
  return {
    area: a.suburb ?? a.neighbourhood ?? a.quarter ?? a.village ?? a.hamlet ?? a.city_district ?? null,
    city: a.city ?? a.town ?? a.municipality ?? a.county ?? null,
    street: a.road ?? null,
    label: row.display_name ?? '',
  }
}
