import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Loader2, LocateFixed, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { useAnchoredPopover } from '@/hooks/useAnchoredPopover'
import { useDebounce } from '@/hooks/useDebounce'
import { useGeolocation } from '@/hooks/useGeolocation'
import { cn } from '@/lib/cn'
import { suggestPlaces } from '@/lib/places'
import { CITIES } from '@/lib/search'

/** A point to search around (results are then sorted by distance from it). */
export type PickupPoint = { label: string; lat: number; lng: number }

type Row =
  | { kind: 'me'; key: string }
  | { kind: 'city'; key: string; name: string }
  | { kind: 'place'; key: string; name: string; details: string; lat: number; lng: number }

type Props = {
  /** What's typed in the box. Typed text that isn't a picked place searches by city, as before. */
  text: string
  onTextChange: (text: string) => void
  /** The picked place, if any. */
  point: PickupPoint | null
  onPointChange: (point: PickupPoint | null) => void
  /** The whole field, so the list lines up under it. */
  anchorRef: RefObject<HTMLElement | null>
  className?: string
}

/** The pick-up location box: quick city choices when empty, real places in Cebu as you type (like a map search). */
export function LocationSearch({ text, onTextChange, point, onPointChange, anchorRef, className }: Props) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const input = useRef<HTMLInputElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const listId = useId()
  const geo = useGeolocation()

  const q = useDebounce(text.trim(), 300)
  const searching = open && q.length >= 2 && !point
  const places = useQuery({
    queryKey: ['places', q.toLowerCase()],
    queryFn: ({ signal }) => suggestPlaces(q, signal),
    enabled: searching,
    staleTime: Infinity,
    retry: false,
    placeholderData: keepPreviousData,
  })

  const typed = text.trim().toLowerCase()
  const rows: Row[] =
    typed.length < 2 || point
      ? [{ kind: 'me', key: 'me' }, ...CITIES.map((c) => ({ kind: 'city' as const, key: c, name: c }))]
      : [
          ...CITIES.filter((c) => c.toLowerCase().includes(typed)).map((c) => ({ kind: 'city' as const, key: c, name: c })),
          ...(places.data ?? []).map((p) => ({ kind: 'place' as const, key: p.id, ...p })),
        ]

  // As wide as the field, about five rows tall, and never on top of the box you're typing in.
  useAnchoredPopover(open, [anchorRef], pop, { matchWidth: 288, shrink: true })

  // Keep the row picked with the arrow keys in view inside the (short) list.
  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active, listId])

  // Escape closes just the list (not the dialog behind it); a click elsewhere closes it too.
  useEffect(() => {
    if (!open) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setOpen(false)
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!pop.current?.contains(t) && !anchorRef.current?.contains(t)) setOpen(false)
    }
    window.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open, anchorRef])

  const choose = async (row: Row) => {
    if (row.kind === 'me') {
      const c = await geo.request()
      if (!c) return toast.error('Allow location access, or search for a place instead.')
      onPointChange({ label: 'My location', lat: c.lat, lng: c.lng })
      onTextChange('My location')
    } else if (row.kind === 'city') {
      onPointChange(null)
      onTextChange(row.name)
    } else {
      onPointChange({ label: row.name, lat: row.lat, lng: row.lng })
      onTextChange(row.name)
    }
    setOpen(false)
    setActive(-1)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      const n = rows.length
      if (n) setActive((i) => (e.key === 'ArrowDown' ? (i + 1) % n : (i - 1 + n) % n))
    } else if (e.key === 'Enter' && open && rows[active]) {
      e.preventDefault() // pick the row instead of submitting the search
      void choose(rows[active])
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  const status = typed.length >= 2 && !point ? (places.isError ? 'error' : places.isFetching && !places.data ? 'loading' : places.data && rows.length === 0 ? 'empty' : null) : null

  return (
    <>
      <input
        ref={input}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && rows[active] ? `${listId}-${active}` : undefined}
        aria-label="Pick-up location"
        autoComplete="off"
        value={text}
        placeholder="Anywhere in Cebu"
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(e) => {
          onTextChange(e.target.value)
          if (point) onPointChange(null)
          setActive(-1)
          setOpen(true)
        }}
        onKeyDown={onKeyDown}
        className={className}
      />
      {open &&
        createPortal(
          <div
            ref={pop}
            style={{ visibility: 'hidden' }}
            className="fixed z-[1100] max-h-[17rem] animate-fade-in overflow-y-auto overscroll-contain rounded-2xl border border-line-200 bg-white p-1.5 text-ink-900 shadow-pop"
          >
            <ul id={listId} role="listbox" aria-label="Pick-up locations">
              {rows.map((row, i) => [
                rows[i - 1]?.kind === 'me' && (
                  <li key="areas" role="presentation" className="px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
                    Popular areas
                  </li>
                ),
                <li
                  key={row.key}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()} // keep focus in the box
                  onClick={() => void choose(row)}
                  className={cn('flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2', i === active && 'bg-page')}
                >
                  <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', row.kind === 'me' ? 'bg-brand-tint text-brand' : 'bg-line-100 text-ink-700')}>
                    {row.kind === 'me' ? geo.loading ? <Loader2 className="size-4 animate-spin" /> : <LocateFixed className="size-4" /> : <MapPin className="size-4" />}
                  </span>
                  <span className="min-w-0 truncate text-sm">
                    {row.kind === 'me' ? (
                      <span className="font-semibold">{geo.loading ? 'Finding you…' : 'Use my location'}</span>
                    ) : (
                      <>
                        <span className="font-semibold">{row.name}</span>
                        <span className="text-ink-500"> {row.kind === 'city' ? 'Cebu' : row.details}</span>
                      </>
                    )}
                  </span>
                </li>,
              ])}
            </ul>
            {status === 'loading' && <p className="flex items-center gap-2 px-3 py-3 text-sm text-ink-500"><Loader2 className="size-4 animate-spin" /> Searching places in Cebu…</p>}
            {status === 'empty' && <p className="px-3 py-3 text-sm text-ink-500">No places found in Cebu. Try a barangay, street, mall or landmark.</p>}
            {status === 'error' && <p className="px-3 py-3 text-sm text-ink-500">Place search isn't available right now. You can still search by city.</p>}
            {typed.length >= 2 && !point && <p className="px-3 pt-1 pb-1 text-[11px] text-ink-400">Places from OpenStreetMap</p>}
          </div>,
          document.body,
        )}
    </>
  )
}
