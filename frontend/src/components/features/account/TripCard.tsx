import { Link } from 'react-router'
import { AlertTriangle, CalendarDays, MapPin } from 'lucide-react'
import { StatusBadge } from '@/components/common/StatusBadge'
import { tripStatus } from '@/lib/status'
import { VehicleImage } from '@/components/common/VehicleImage'
import { Button } from '@/components/ui'
import { formatDateTime, peso, timeUntil } from '@/lib/format'
import type { BookingRow } from '@/types'

export function TripCard({ b, base = '/account/trips' }: { b: BookingRow; base?: string }) {
  const v = b.vehicle
  const s = tripStatus(b)
  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-line-200 bg-white p-4 shadow-card sm:flex-row sm:items-center">
      <Link to={`${base}/${b.reference}`} className="h-28 overflow-hidden rounded-xl sm:h-24 sm:w-36 sm:shrink-0">
        {v && <VehicleImage photo={v.photo} type={v.type} color={v.color_hex} alt={v.name} />}
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={s} />
          <span className="text-xs text-ink-400">{b.reference}</span>
          {b.balance_due > 0 && <span className="inline-flex items-center gap-1 text-xs font-semibold text-danger"><AlertTriangle className="size-3.5" /> {peso(b.balance_due)} due</span>}
        </div>
        <Link to={`${base}/${b.reference}`} className="mt-1 block truncate py-2 text-lg font-bold hover:text-brand">{v?.name}</Link>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-500">
          <span className="flex items-center gap-1"><CalendarDays className="size-4" /> {formatDateTime(b.pickup_at)} → {formatDateTime(b.return_at)}</span>
          <span className="flex items-center gap-1"><MapPin className="size-4" /> {b.pickup_label}</span>
        </p>
        {b.status === 'pending' && <p className="mt-1 text-xs font-semibold text-warning">Not paid yet – open it to finish paying.</p>}
        {b.display_status === 'upcoming' && <p className="mt-1 text-xs font-semibold text-info">Starts in {timeUntil(b.pickup_at)}</p>}
      </div>
      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
        <p className="text-right"><span className="block text-xs text-ink-500">Trip total</span><span className="font-bold">{peso(b.total)}</span></p>
        <div className="flex gap-2">
          {b.can_review && base === '/account/trips' && <Button size="sm" variant="accent" to={`${base}/${b.reference}?review=1`}>Leave a review</Button>}
          <Button size="sm" variant={b.display_status === 'upcoming' ? 'primary' : 'secondary'} to={`${base}/${b.reference}`}>View booking</Button>
        </div>
      </div>
    </article>
  )
}
