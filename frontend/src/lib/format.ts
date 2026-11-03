const PH = 'en-PH'

export function peso(amount: number | null | undefined, opts: { decimals?: boolean } = {}) {
  const n = Number(amount ?? 0)
  return '₱' + n.toLocaleString(PH, { minimumFractionDigits: opts.decimals ? 2 : 0, maximumFractionDigits: opts.decimals ? 2 : 0 })
}

export function compactPeso(amount: number) {
  if (amount >= 1_000_000) return '₱' + (amount / 1_000_000).toFixed(amount >= 10_000_000 ? 1 : 2).replace(/\.0+$/, '') + 'M'
  if (amount >= 10_000) return '₱' + Math.round(amount / 1000) + 'K'
  return peso(amount)
}

export function formatDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(PH, opts)
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString(PH, { weekday: 'short', month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString(PH, { hour: 'numeric', minute: '2-digit' })}`
}

export function formatTime(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString(PH, { hour: 'numeric', minute: '2-digit' })
}

export function formatRange(from: string, to: string) {
  const a = new Date(from)
  const b = new Date(to)
  const sameYear = a.getFullYear() === b.getFullYear()
  const left = a.toLocaleDateString(PH, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })
  const right = b.toLocaleDateString(PH, { month: 'short', day: 'numeric', year: 'numeric' })
  return `${left} – ${right}`
}

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return ''
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 45) return 'just now'
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`
  if (diff < 86400) return `${Math.round(diff / 3600)} h ago`
  if (diff < 86400 * 7) return `${Math.round(diff / 86400)} d ago`
  return formatDate(iso)
}

export function timeUntil(iso: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000
  if (diff <= 0) return 'now'
  const d = Math.floor(diff / 86400)
  const h = Math.floor((diff % 86400) / 3600)
  if (d > 0) return `${d} day${d > 1 ? 's' : ''}${h ? ` ${h} h` : ''}`
  const m = Math.floor((diff % 3600) / 60)
  return h > 0 ? `${h} h ${m} min` : `${m} min`
}

export function capitalize(s: string | null | undefined) {
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')
}

/** Value for <input type="datetime-local"> from a Date. */
export function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Local datetime string -> ISO string (keeps the customer's timezone). */
export function localToIso(local: string) {
  return new Date(local).toISOString()
}

/** Default trip: tomorrow 10:00 to the day after, 10:00. */
export function defaultTrip(days = 2) {
  const start = new Date()
  start.setDate(start.getDate() + 1)
  start.setHours(10, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + days)
  return { pickup: toLocalInput(start), ret: toLocalInput(end) }
}

export function tripDays(pickup: string, ret: string) {
  const ms = new Date(ret).getTime() - new Date(pickup).getTime()
  if (!Number.isFinite(ms) || ms <= 0) return 0
  return Math.max(1, Math.ceil(ms / 3600000 / 24))
}

export function plural(n: number, word: string, pluralWord?: string) {
  return `${n.toLocaleString(PH)} ${n === 1 ? word : pluralWord ?? word + 's'}`
}
