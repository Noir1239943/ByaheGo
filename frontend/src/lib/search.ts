export const CITIES = ['Cebu City', 'Mandaue City', 'Lapu-Lapu City', 'Cordova', 'Talisay City', 'Consolacion']

/** Browse URL for a search (dates are kept as local date-times so the URL is readable and shareable). */
export function buildSearchUrl(location: string, pickup: string, ret: string, extra: Record<string, string> = {}) {
  const p = new URLSearchParams({ ...(location ? { location } : {}), pickup, return: ret, ...extra })
  return `/vehicles?${p.toString()}`
}
