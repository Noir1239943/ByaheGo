/** Centers of the cities and towns we serve, used to start a map and to search "near" an area. */
export type Area = { label: string; lat: number; lng: number }

export const CEBU_AREAS: Area[] = [
  { label: 'Cebu City', lat: 10.3157, lng: 123.8854 },
  { label: 'Mandaue City', lat: 10.3236, lng: 123.9223 },
  { label: 'Lapu-Lapu City', lat: 10.3103, lng: 123.9494 },
  { label: 'Talisay City', lat: 10.2447, lng: 123.8494 },
  { label: 'Cordova', lat: 10.2526, lng: 123.9493 },
  { label: 'Consolacion', lat: 10.3766, lng: 123.9573 },
  { label: 'Liloan', lat: 10.3997, lng: 123.9981 },
  { label: 'Minglanilla', lat: 10.2447, lng: 123.7961 },
  { label: 'Naga City', lat: 10.2086, lng: 123.7584 },
]

const DEFAULT_CENTER: [number, number] = [10.3157, 123.8854]

export const areaCenter = (city: string): [number, number] => {
  const a = CEBU_AREAS.find((x) => x.label === city)
  return a ? [a.lat, a.lng] : DEFAULT_CENTER
}

export const RADIUS_OPTIONS = [2, 5, 10, 25, 50]
