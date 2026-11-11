/**
 * Place search as you type, for the pick-up location box. It uses Photon (https://photon.komoot.io): OpenStreetMap data,
 * built for autocomplete, no API key. (Nominatim's usage policy doesn't allow search-as-you-type, so lib/nominatim.ts
 * stays for one-off lookups.) Results are limited to Cebu and cached; the caller debounces and cancels stale requests.
 * Photon is a free shared service: if the app grows, run your own Photon or proxy it through the API.
 */
const BASE = 'https://photon.komoot.io/api/'
/** minLon,minLat,maxLon,maxLat around Cebu island, Mactan and the small islands nearby. */
const CEBU_BBOX = '123.25,9.4,124.1,11.35'
/** Photon's "state" is the province, except for Cebu City, Mandaue and Lapu-Lapu, which report the region. */
const CEBU_STATES = new Set(['Cebu', 'Central Visayas'])

export type PlaceHit = { id: string; name: string; details: string; lat: number; lng: number }

type Feature = {
  geometry: { coordinates: [number, number] }
  properties: { osm_id?: number; osm_type?: string; name?: string; street?: string; district?: string; locality?: string; city?: string; county?: string; state?: string }
}

const cache = new Map<string, PlaceHit[]>()

export async function suggestPlaces(query: string, signal?: AbortSignal): Promise<PlaceHit[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const key = q.toLowerCase()
  const cached = cache.get(key)
  if (cached) return cached

  const params = new URLSearchParams({ q, limit: '12', lang: 'en', bbox: CEBU_BBOX, lat: '10.32', lon: '123.9' })
  const res = await fetch(`${BASE}?${params}`, { signal })
  if (!res.ok) throw new Error('Place search is busy right now. Try again in a moment.')
  const { features } = (await res.json()) as { features: Feature[] }

  const seen = new Set<string>()
  const hits: PlaceHit[] = []
  for (const f of features) {
    const p = f.properties
    if (!p.name || (p.state && !CEBU_STATES.has(p.state))) continue
    const parts = [p.street, p.district ?? p.locality, p.city ?? p.county].filter((x): x is string => !!x && x !== p.name)
    if (!parts.some((x) => x.includes('Cebu'))) parts.push('Cebu')
    const details = [...new Set(parts)].join(', ')
    const dedupe = `${p.name}|${details}`.toLowerCase()
    const [lng, lat] = f.geometry.coordinates
    // A mall is often mapped several times (building, shop, area): same name within ~300 m counts once.
    if (seen.has(dedupe) || hits.some((h) => h.name === p.name && Math.abs(h.lat - lat) < 0.003 && Math.abs(h.lng - lng) < 0.003)) continue
    seen.add(dedupe)
    hits.push({ id: `${p.osm_type ?? ''}${p.osm_id ?? hits.length}`, name: p.name, details, lat, lng })
    if (hits.length === 8) break
  }
  cache.set(key, hits)
  return hits
}
