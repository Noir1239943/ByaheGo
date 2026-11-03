import { useRef, useState, type MouseEvent } from 'react'
import { Fuel, Gauge, MapPin, Route, X, ZoomIn } from 'lucide-react'
import { Button, Modal } from '@/components/ui'
import { useMediaUrl } from '@/hooks/useMediaUrl'
import { cn } from '@/lib/cn'
import { fuelLabel } from '@/lib/trip/capture'
import type { DamagePin, TripInfo, TripPhoto } from '@/types'
import { LiveBadge } from './TripPhotos'

interface Props {
  trip: TripInfo
  pins: DamagePin[]
  /** When given, the host can tap the return photo to mark new damage. */
  onPin?: (pin: DamagePin) => void
  onRemovePin?: (index: number) => void
}

const firstOf = (photos: TripPhoto[] | undefined, angle: string) => photos?.find((p) => p.angle === angle)

/**
 * Before/after for one angle: a slider that wipes between the check-in and return photos, tap-to-zoom, and (for the host) tap-to-pin
 * new damage. Also shows the kilometres driven and the fuel difference.
 */
export function PhotoCompare({ trip, pins, onPin, onRemovePin }: Props) {
  const angles = (trip.checkin?.photos ?? []).filter((p) => p.angle !== 'damage' && p.angle !== 'host_extra')
  const [angle, setAngle] = useState(angles[0]?.angle ?? 'front')
  const [pos, setPos] = useState(50)
  const [pinMode, setPinMode] = useState(false)
  const [zoom, setZoom] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  const before = firstOf(trip.checkin?.photos, angle)
  const after = firstOf(trip.checkout?.photos, angle)
  const beforeUrl = useMediaUrl(before?.media_id, 1200).url
  const afterUrl = useMediaUrl(after?.media_id, 1200).url
  const here = pins.map((p, i) => ({ ...p, i })).filter((p) => p.angle === angle)

  if (!trip.checkin || !trip.checkout) return null
  const km = trip.checkout.odometer - trip.checkin.odometer
  const fuelDiff = trip.checkout.fuel_level - trip.checkin.fuel_level

  const place = (e: MouseEvent) => {
    if (!pinMode || !onPin || !box.current) return
    const r = box.current.getBoundingClientRect()
    onPin({ angle, x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)), note: '' })
    setPinMode(false)
  }

  const stage = (
    <div ref={box} className={cn('relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-ink-900 sm:aspect-video', pinMode && 'cursor-crosshair ring-2 ring-danger')} onClick={place} data-testid="compare-stage">
      {afterUrl && <img src={afterUrl} alt={`${angle} after`} className="absolute inset-0 size-full object-contain" />}
      {beforeUrl && <img src={beforeUrl} alt={`${angle} before`} className="absolute inset-0 size-full object-contain" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />}
      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,.4)]" style={{ left: `${pos}%` }} />
      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-0.5 text-xs font-semibold text-white">Before (check-in)</span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-0.5 text-xs font-semibold text-white">After (return)</span>
      {here.map((p) => (
        <span key={p.i} className="pointer-events-none absolute -translate-x-1/2 -translate-y-full text-danger drop-shadow" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }} title={p.note}>
          <MapPin className="size-7 fill-danger text-white" />
        </span>
      ))}
      {(!beforeUrl || !afterUrl) && <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">Loading photos…</div>}
    </div>
  )

  return (
    <div>
      <div className="flex flex-wrap gap-4 rounded-2xl bg-page p-3 text-sm">
        <span className="flex items-center gap-1.5"><Route className="size-4 text-brand" /> <b>{km.toLocaleString()} km</b> driven</span>
        <span className="flex items-center gap-1.5"><Gauge className="size-4 text-brand" /> {trip.checkin.odometer.toLocaleString()} → {trip.checkout.odometer.toLocaleString()} km</span>
        <span className="flex items-center gap-1.5"><Fuel className="size-4 text-brand" /> Fuel {fuelLabel(trip.checkin.fuel_level)} → {fuelLabel(trip.checkout.fuel_level)}{fuelDiff < 0 ? <span className="font-semibold text-danger"> (down {Math.abs(fuelDiff)}%)</span> : fuelDiff > 0 ? <span className="font-semibold text-success"> (up {fuelDiff}%)</span> : ' (same)'}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Angle">
        {angles.map((p) => (
          <button key={p.angle} type="button" role="tab" aria-selected={angle === p.angle} onClick={() => setAngle(p.angle)} className={cn('rounded-full px-3 py-1 text-xs font-semibold transition', angle === p.angle ? 'bg-brand text-white' : 'bg-line-100 text-ink-700 hover:bg-line-200')}>
            {p.label}{pins.some((x) => x.angle === p.angle) ? ' 📍' : ''}
          </button>
        ))}
      </div>
      <div className="mt-3">{stage}</div>
      <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} className="mt-3 w-full accent-brand" aria-label="Slide between before and after" data-testid="compare-slider" />
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">{before && <LiveBadge live={before.live} />}{after && <LiveBadge live={after.live} />}</div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" icon={<ZoomIn className="size-4" />} onClick={() => setZoom(true)}>Zoom</Button>
          {onPin && <Button size="sm" variant={pinMode ? 'danger' : 'secondary'} icon={<MapPin className="size-4" />} onClick={() => setPinMode((v) => !v)} data-testid="pin-mode">{pinMode ? 'Tap the damage…' : 'Mark new damage'}</Button>}
        </div>
      </div>
      {pins.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-sm">
          {pins.map((p, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-1.5 text-xs"><MapPin className="size-3.5 text-danger" /><span className="font-semibold capitalize">{p.angle.replace('_', ' ')}</span><span className="flex-1 truncate text-ink-700">{p.note || 'No note'}</span>{onRemovePin && <button type="button" onClick={() => onRemovePin(i)} aria-label="Remove pin"><X className="size-3.5" /></button>}</li>
          ))}
        </ul>
      )}
      <Modal open={zoom} onClose={() => setZoom(false)} title={`Zoom: ${before?.label ?? angle}`} size="lg">
        <div className="grid gap-3 sm:grid-cols-2">
          {beforeUrl && <figure><img src={beforeUrl} alt="Before" className="w-full rounded-xl" /><figcaption className="mt-1 text-xs text-ink-500">Before (check-in)</figcaption></figure>}
          {afterUrl && <figure><img src={afterUrl} alt="After" className="w-full rounded-xl" /><figcaption className="mt-1 text-xs text-ink-500">After (return)</figcaption></figure>}
        </div>
      </Modal>
    </div>
  )
}
