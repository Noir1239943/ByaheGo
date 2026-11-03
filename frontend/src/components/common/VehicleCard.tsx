import { Link } from 'react-router'
import { Heart, MapPin, Navigation, Zap } from 'lucide-react'
import { useFavorites } from '@/hooks/useFavorites'
import { typeLabel } from '@/lib/constants'
import { cn } from '@/lib/cn'
import { capitalize, peso } from '@/lib/format'
import type { VehicleCard as Vehicle } from '@/types'
import { RatingInline } from './RatingStars'
import { VehicleImage } from './VehicleImage'

type Props = { vehicle: Vehicle; query?: string; className?: string; compact?: boolean; highlight?: boolean; onHover?: (id: number | null) => void }

export function VehicleCard({ vehicle: v, query = '', className, compact, highlight, onHover }: Props) {
  const { isSaved, toggle } = useFavorites()
  const saved = isSaved(v.id)
  return (
    <article
      onMouseEnter={() => onHover?.(v.id)}
      onMouseLeave={() => onHover?.(null)}
      className={cn('group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-pop', highlight ? 'border-brand ring-2 ring-brand/20' : 'border-line-200', className)}
    >
      <Link to={`/vehicles/${v.id}${query}`} className="absolute inset-0 z-[1]" aria-label={`View ${v.name}`} />
      <div className={cn('relative overflow-hidden', compact ? 'aspect-[16/9]' : 'aspect-[4/3]')}>
        <VehicleImage photo={v.photo} type={v.type} color={v.color_hex} alt={v.name} className="transition duration-300 group-hover:scale-[1.03]" />
        {v.instant_book && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-ink-900 shadow-sm">
            <Zap className="size-3 fill-brand text-brand" /> Instant book
          </span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            toggle(v.id)
          }}
          className="absolute top-2.5 right-2.5 z-[2] flex size-9 items-center justify-center rounded-full bg-white/95 shadow-sm transition hover:scale-105"
          aria-label={saved ? `Remove ${v.name} from saved` : `Save ${v.name}`}
          aria-pressed={saved}
        >
          <Heart className={cn('size-4.5', saved ? 'fill-danger text-danger' : 'text-ink-700')} />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate font-bold text-ink-900">
            {v.make} {v.model} <span className="font-medium text-ink-500">{v.year}</span>
          </h3>
          <RatingInline value={v.rating_avg} count={v.rating_count} className="shrink-0" />
        </div>
        <p className="text-xs text-ink-500">
          {typeLabel(v.type)} · {v.seats} seats · {capitalize(v.transmission)}
        </p>
        <p className="flex items-center gap-1 truncate text-xs text-ink-500">
          <MapPin className="size-3.5 shrink-0" /> {v.location_label}
        </p>
        {typeof v.distance_km === 'number' && (
          <p className="flex items-center gap-1 text-xs font-semibold text-brand">
            <Navigation className="size-3.5" /> {v.distance_km < 1 ? 'Less than 1 km away' : `${v.distance_km} km away`}
          </p>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 border-t border-line-100 pt-3">
          <p>
            <span className="text-lg font-extrabold text-ink-900">{peso(v.daily_rate)}</span>
            <span className="text-xs text-ink-500"> /day</span>
          </p>
          <span className="text-[11px] font-semibold text-success">{v.with_driver_available ? 'Driver available' : v.delivery_available ? 'Delivery available' : 'Free cancellation'}</span>
        </div>
      </div>
    </article>
  )
}
