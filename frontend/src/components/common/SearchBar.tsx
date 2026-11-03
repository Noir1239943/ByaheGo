import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { CalendarDays, LocateFixed, MapPin, Search } from 'lucide-react'
import { Button, Modal } from '@/components/ui'
import { cn } from '@/lib/cn'
import { defaultTrip, formatRange, tripDays } from '@/lib/format'
import { buildSearchUrl, CITIES } from '@/lib/search'


function useSearchState() {
  const [params] = useSearchParams()
  const d = defaultTrip()
  return {
    location: params.get('location') ?? '',
    pickup: params.get('pickup') ?? d.pickup,
    ret: params.get('return') ?? d.ret,
    hasDates: !!params.get('pickup'),
  }
}


type FormProps = { layout?: 'hero' | 'stack'; onDone?: () => void }

export function SearchForm({ layout = 'hero', onDone }: FormProps) {
  const initial = useSearchState()
  const [location, setLocation] = useState(initial.location)
  const [pickup, setPickup] = useState(initial.pickup)
  const [ret, setRet] = useState(initial.ret)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const submit = (e: FormEvent, near = false) => {
    e.preventDefault()
    if (new Date(ret) <= new Date(pickup)) return setError('Return needs to be after pick-up.')
    setError('')
    navigate(buildSearchUrl(near ? '' : location, pickup, ret, near ? { sort: 'nearest' } : {}))
    onDone?.()
  }

  const days = tripDays(pickup, ret)
  const field = 'flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3.5 py-2.5 transition hover:bg-page focus-within:bg-page'
  const label = 'block text-[11px] font-semibold tracking-wide text-ink-500 uppercase'
  const input = 'w-full bg-transparent text-sm font-semibold text-ink-900 outline-none placeholder:font-medium placeholder:text-ink-400'

  return (
    <form onSubmit={submit} className={cn('w-full', layout === 'hero' && 'rounded-2xl bg-white p-2 shadow-pop')}>
      <div className={cn('flex gap-1', layout === 'hero' ? 'flex-col md:flex-row md:items-stretch' : 'flex-col')}>
        <label className={cn(field, layout === 'stack' && 'border border-line-200')}>
          <MapPin className="size-5 shrink-0 text-brand" />
          <span className="min-w-0 flex-1">
            <span className={label}>Pick-up location</span>
            <input list="byahego-cities" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Anywhere in Cebu" className={input} aria-label="Pick-up location" />
            <datalist id="byahego-cities">
              {CITIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </span>
        </label>
        <span className="hidden w-px self-stretch bg-line-200 md:block" />
        <label className={cn(field, layout === 'stack' && 'border border-line-200')}>
          <CalendarDays className="size-5 shrink-0 text-brand" />
          <span className="min-w-0 flex-1">
            <span className={label}>Pick-up</span>
            <input type="datetime-local" value={pickup} onChange={(e) => setPickup(e.target.value)} className={input} aria-label="Pick-up date and time" required />
          </span>
        </label>
        <span className="hidden w-px self-stretch bg-line-200 md:block" />
        <label className={cn(field, layout === 'stack' && 'border border-line-200')}>
          <CalendarDays className="size-5 shrink-0 text-brand" />
          <span className="min-w-0 flex-1">
            <span className={label}>Return {days > 0 && <span className="normal-case text-brand">· {days} day{days > 1 ? 's' : ''}</span>}</span>
            <input type="datetime-local" value={ret} min={pickup} onChange={(e) => setRet(e.target.value)} className={input} aria-label="Return date and time" required />
          </span>
        </label>
        <Button type="submit" variant="accent" size="lg" className={cn(layout === 'hero' ? 'md:h-auto md:px-7' : 'mt-2')} icon={<Search className="size-5" />}>
          Search
        </Button>
      </div>
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
        <span className="truncate font-semibold">{s.location || 'Anywhere in Cebu'}</span>
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
