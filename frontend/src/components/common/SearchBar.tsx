import { useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { CalendarDays, LocateFixed, MapPin, Search } from 'lucide-react'
import { Button, DateRangePicker, DateTrigger, Modal, type DateTab } from '@/components/ui'
import { cn } from '@/lib/cn'
import { defaultTrip, formatRange, tripDays } from '@/lib/format'
import { buildSearchUrl } from '@/lib/search'
import { LocationSearch, type PickupPoint } from './LocationSearch'


function useSearchState() {
  const [params] = useSearchParams()
  const d = defaultTrip()
  const lat = Number(params.get('lat'))
  const lng = Number(params.get('lng'))
  const point: PickupPoint | null = params.get('lat') && params.get('lng') && Number.isFinite(lat) && Number.isFinite(lng) ? { label: params.get('place') || 'Chosen spot', lat, lng } : null
  return {
    location: params.get('location') ?? '',
    point,
    radius: params.get('radius') || '10',
    pickup: params.get('pickup') ?? d.pickup,
    ret: params.get('return') ?? d.ret,
    hasDates: !!params.get('pickup'),
  }
}


type FormProps = { layout?: 'hero' | 'stack'; onDone?: () => void }

export function SearchForm({ layout = 'hero', onDone }: FormProps) {
  const initial = useSearchState()
  const [location, setLocation] = useState(initial.location || initial.point?.label || '')
  const [point, setPoint] = useState(initial.point)
  const [pickup, setPickup] = useState(initial.pickup)
  const [ret, setRet] = useState(initial.ret)
  const [dates, setDates] = useState<DateTab | null>(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const locationField = useRef<HTMLLabelElement>(null)
  const pickupField = useRef<HTMLLabelElement>(null)
  const returnField = useRef<HTMLLabelElement>(null)

  const submit = (e: FormEvent, near = false) => {
    e.preventDefault()
    // Dates are optional (Clear dates searches everything), but if one is set both must make a real, future trip.
    if (pickup || ret) {
      if (!pickup || !ret) return setError('Choose both a pick-up and a return date, or clear the dates.')
      if (new Date(pickup) < new Date()) return setError('That pick-up time has passed. Choose a later one.')
      if (new Date(ret) <= new Date(pickup)) return setError('Return needs to be after pick-up.')
    }
    setError('')
    // A picked place searches around that spot, sorted by distance (like the "Near" filter); typed text searches by city.
    const around = !near && point ? { lat: point.lat.toFixed(5), lng: point.lng.toFixed(5), place: point.label, radius: initial.radius, sort: 'nearest' } : null
    navigate(buildSearchUrl(near || around ? '' : location, pickup, ret, near ? { sort: 'nearest' } : (around ?? {})))
    onDone?.()
  }

  const days = tripDays(pickup, ret)
  const field = 'flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3.5 py-2.5 transition hover:bg-page focus-within:bg-page'
  const label = 'block text-[11px] font-semibold tracking-wide text-ink-500 uppercase'
  const input = 'w-full bg-transparent text-sm font-semibold text-ink-900 outline-none placeholder:font-medium placeholder:text-ink-400'

  return (
    <form onSubmit={submit} className={cn('w-full', layout === 'hero' && 'rounded-2xl bg-white p-2 shadow-pop')}>
      <div className={cn('flex gap-1', layout === 'hero' ? 'flex-col md:flex-row md:items-stretch' : 'flex-col')}>
        <label ref={locationField} className={cn(field, layout === 'stack' && 'border border-line-200')}>
          <MapPin className="size-5 shrink-0 text-brand" />
          <span className="min-w-0 flex-1">
            <span className={label}>Pick-up location</span>
            <LocationSearch text={location} onTextChange={setLocation} point={point} onPointChange={setPoint} anchorRef={locationField} className={input} />
          </span>
        </label>
        <span className="hidden w-px self-stretch bg-line-200 md:block" />
        <label ref={pickupField} className={cn(field, 'cursor-pointer', dates === 'pickup' && 'bg-page', layout === 'stack' && 'border border-line-200')}>
          <CalendarDays className="size-5 shrink-0 text-brand" />
          <span className="min-w-0 flex-1">
            <span className={label}>Pick-up</span>
            <DateTrigger tab="pickup" value={pickup} open={dates} onOpenChange={setDates} className={input} />
          </span>
        </label>
        <span className="hidden w-px self-stretch bg-line-200 md:block" />
        <label ref={returnField} className={cn(field, 'cursor-pointer', dates === 'return' && 'bg-page', layout === 'stack' && 'border border-line-200')}>
          <CalendarDays className="size-5 shrink-0 text-brand" />
          <span className="min-w-0 flex-1">
            <span className={label}>Return {days > 0 && <span className="normal-case text-brand">· {days} day{days > 1 ? 's' : ''}</span>}</span>
            <DateTrigger tab="return" value={ret} open={dates} onOpenChange={setDates} className={input} />
          </span>
        </label>
        <Button type="submit" variant="accent" size="lg" className={cn(layout === 'hero' ? 'md:h-auto md:px-7' : 'mt-2')} icon={<Search className="size-5" />}>
          Search
        </Button>
      </div>
      <DateRangePicker
        open={dates}
        onOpenChange={setDates}
        pickup={pickup}
        ret={ret}
        onChange={(next) => {
          setPickup(next.pickup)
          setRet(next.ret)
          setError('')
        }}
        anchors={[pickupField, returnField]}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-2">
        {error ? <p className="text-xs font-medium text-danger">{error}</p> : <span />}
        <button type="button" onClick={(e) => submit(e, true)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline">
          <LocateFixed className="size-3.5" /> Show cars nearest to me
        </button>
      </div>
    </form>
  )
}

/** Compact search pill for the header; opens the full search form. */
export function SearchPill({ className }: { className?: string }) {
  const s = useSearchState()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)} className={cn('flex h-11 items-center gap-2 rounded-full border border-line-200 bg-page pr-1.5 pl-4 text-left text-sm shadow-sm transition hover:border-ink-400', className)}>
        <MapPin className="size-4 shrink-0 text-brand" />
        <span className="truncate font-semibold">{s.location || s.point?.label || 'Anywhere in Cebu'}</span>
        <span className="h-5 w-px bg-line-200" />
        <CalendarDays className="size-4 shrink-0 text-brand" />
        <span className="truncate text-ink-500">{s.hasDates ? `${formatRange(s.pickup, s.ret)} · ${tripDays(s.pickup, s.ret)}d` : 'Add dates'}</span>
        <span className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-full bg-accent">
          <Search className="size-4 text-ink-900" />
        </span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Find your ride" description="Pick where and when – we'll show cars that are free for your dates.">
        <SearchForm layout="stack" onDone={() => setOpen(false)} />
      </Modal>
    </>
  )
}
