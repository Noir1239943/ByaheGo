import { useState } from 'react'
import { Camera, Check, Clock, Fuel, Gauge, ShieldAlert, Upload } from 'lucide-react'
import { ProtectedImage } from '@/components/common/ProtectedImage'
import { Badge, Modal } from '@/components/ui'
import { useMediaUrl } from '@/hooks/useMediaUrl'
import { formatDateTime } from '@/lib/format'
import { fuelLabel } from '@/lib/trip/capture'
import type { TripInfo, TripInspection, TripPhoto } from '@/types'

const HOST_STATUS: Record<string, { tone: 'success' | 'warning' | 'neutral'; text: string }> = {
  pending: { tone: 'warning', text: 'Waiting for the host to confirm' },
  confirmed: { tone: 'success', text: 'Host confirmed the condition' },
  auto_accepted: { tone: 'neutral', text: 'Accepted automatically (no host response)' },
}

export function LiveBadge({ live }: { live: boolean }) {
  return live
    ? <Badge tone="success"><Camera className="mr-1 size-3" /> Live</Badge>
    : <Badge tone="warning"><Upload className="mr-1 size-3" /> Uploaded, not live</Badge>
}

function PhotoDetails({ p }: { p: TripPhoto }) {
  const url = useMediaUrl(p.media_id).url
  return (
    <div>
      {url ? <img src={url} alt={p.label} className="max-h-[70vh] w-full rounded-xl object-contain" /> : <div className="h-64 animate-pulse rounded-xl bg-line-100" />}
      <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div><dt className="text-xs text-ink-500">Taken by</dt><dd className="font-medium">{p.uploader_role === 'host' ? 'Host' : 'Renter'} · <LiveBadge live={p.live} /></dd></div>
        <div><dt className="text-xs text-ink-500">Phone clock</dt><dd className="font-medium">{p.device_time ? formatDateTime(p.device_time) : 'Not recorded'}</dd></div>
        <div><dt className="text-xs text-ink-500">Server time</dt><dd className="font-medium">{p.server_time ? formatDateTime(p.server_time) : '—'}</dd></div>
        <div><dt className="text-xs text-ink-500">Location</dt><dd className="font-medium">{p.lat != null && p.lng != null ? <a className="text-brand hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`}>{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</a> : 'Not shared'}</dd></div>
        {p.note && <div className="sm:col-span-2"><dt className="text-xs text-ink-500">Note</dt><dd className="font-medium">{p.note}</dd></div>}
        <div className="sm:col-span-2"><dt className="text-xs text-ink-500">File fingerprint (SHA-256)</dt><dd className="break-all font-mono text-[11px] text-ink-700">{p.sha256}</dd></div>
      </dl>
    </div>
  )
}

/** The photos of one check-in or check-out: readings, host response, and a grid you can tap to zoom. */
function InspectionPhotos({ inspection, title }: { inspection: TripInspection; title: string }) {
  const [zoom, setZoom] = useState<TripPhoto | null>(null)
  const status = inspection.host_status ? HOST_STATUS[inspection.host_status] : null
  return (
    <div className="rounded-2xl border border-line-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-xs text-ink-500">Submitted {formatDateTime(inspection.submitted_at)}</p>
        </div>
        {status && <Badge tone={status.tone} dot>{status.text}</Badge>}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <span className="flex items-center gap-1.5"><Gauge className="size-4 text-brand" /> {inspection.odometer.toLocaleString()} km</span>
        <span className="flex items-center gap-1.5"><Fuel className="size-4 text-brand" /> Fuel {fuelLabel(inspection.fuel_level)}</span>
        <span className="flex items-center gap-1.5 text-ink-500"><Camera className="size-4" /> {inspection.photos.length} photos</span>
      </div>
      {inspection.notes && <p className="mt-2 rounded-lg bg-page p-2.5 text-xs text-ink-700">“{inspection.notes}”</p>}
      {inspection.host_notes && <p className="mt-2 rounded-lg bg-brand-tint p-2.5 text-xs text-ink-700">Host: “{inspection.host_notes}”</p>}
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {inspection.photos.map((p) => (
          <li key={p.id} className="relative">
            <ProtectedImage id={p.media_id} alt={p.label} width={480} className="aspect-[4/3] w-full" onOpen={() => setZoom(p)} />
            <span className="mt-1 block truncate text-[11px] font-medium text-ink-700">{p.label}</span>
            {!p.live && <span className="absolute left-1 top-1 rounded bg-warning px-1 text-[9px] font-bold text-white" title="Uploaded from the gallery, not taken live">NOT LIVE</span>}
            {p.uploader_role === 'host' && <span className="absolute right-1 top-1 rounded bg-ink-900/80 px-1 text-[9px] font-bold text-white">HOST</span>}
          </li>
        ))}
      </ul>
      <Modal open={!!zoom} onClose={() => setZoom(null)} title={zoom?.label ?? 'Photo'} size="lg">{zoom && <PhotoDetails p={zoom} />}</Modal>
    </div>
  )
}

/** Both photo sets of a trip, for the renter, the host and admins. */
export function TripPhotos({ trip }: { trip: TripInfo }) {
  if (!trip.checkin && !trip.checkout) return <p className="text-sm text-ink-500">No check-in photos yet. The renter takes them in the app just before the trip starts.</p>
  return (
    <div className="space-y-4">
      {trip.checkin && <InspectionPhotos inspection={trip.checkin} title="Check-in photos (before the trip)" />}
      {trip.checkout && <InspectionPhotos inspection={trip.checkout} title="Return photos (after the trip)" />}
      <p className="flex items-start gap-1.5 text-xs text-ink-500"><ShieldAlert className="mt-0.5 size-3.5 shrink-0" /> Photos can't be edited or removed once submitted. Only extra photos can be added.</p>
    </div>
  )
}

export function HostStatusLine({ inspection }: { inspection: TripInspection | null }) {
  if (!inspection?.host_status) return null
  const s = HOST_STATUS[inspection.host_status]
  return <p className="flex items-center gap-1.5 text-xs text-ink-500">{inspection.host_status === 'pending' ? <Clock className="size-3.5" /> : <Check className="size-3.5 text-success" />} {s.text}{inspection.host_window_ends_at && ` (until ${formatDateTime(inspection.host_window_ends_at)})`}</p>
}

