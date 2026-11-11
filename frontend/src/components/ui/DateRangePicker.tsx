import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAnchoredPopover } from '@/hooks/useAnchoredPopover'
import { cn } from '@/lib/cn'
import { toLocalInput, tripDays } from '@/lib/format'
import { Button } from './Button'
import { TimeField, type ClockTime } from './TimeField'

const PH = 'en-PH'
/** A day counts as open when it has a free half hour. (Times themselves can be any minute.) */
const DAY_CHECK_STEP = 30
const PHONE = '(max-width: 639px)'
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => new Date(2023, 0, 1 + i)) // Jan 1, 2023 was a Sunday

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1)
const sameDay = (a: Date | null, b: Date | null) => !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth()
const dayKey = (d: Date) => toLocalInput(d).slice(0, 10)
const timeLabel = (d: Date) => d.toLocaleTimeString(PH, { hour: 'numeric', minute: '2-digit' })
const slotsOf = (day: Date) => Array.from({ length: (24 * 60) / DAY_CHECK_STEP }, (_, i) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, i * DAY_CHECK_STEP))
const atTime = (day: Date, t: ClockTime) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), t.h, t.m)
const clockOf = (d: Date): ClockTime => ({ h: d.getHours(), m: d.getMinutes() })
const addMinutes = (d: Date, n: number) => new Date(d.getTime() + n * 60_000)

/** Round up to a whole minute, or (step 5) to a tidy time for suggestions: 9:12 becomes 9:15. */
function ceilMinutes(d: Date, step = 1) {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes())
  if (r < d) r.setMinutes(r.getMinutes() + 1)
  const extra = r.getMinutes() % step
  if (extra) r.setMinutes(r.getMinutes() + step - extra)
  return r
}

function parseLocal(value: string | undefined) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** "Nov 12, 2026, 10:00 AM" (or "Nov 12, 10:00 AM" when compact), or null when no date is set. */
function formatTripDate(value: string, compact = false) {
  const d = parseLocal(value)
  if (!d) return null
  return `${d.toLocaleDateString(PH, { month: 'short', day: 'numeric', ...(compact ? {} : { year: 'numeric' }) })}, ${timeLabel(d)}`
}

export type DateTab = 'pickup' | 'return'
export type BookedRange = { from: string; to: string }
type Range = { from: Date; to: Date }

/** Same rules as the API's PricingService: pick-up at least an hour from now, trips up to 30 days. */
const LEAD_MINUTES = 60
const MAX_TRIP_DAYS = 30

/** What can be picked, given the time the panel opened, the chosen pick-up and the vehicle's bookings. */
function rulesFor(now: Date, pickup: Date | null, booked: Range[]) {
  const earliest = ceilMinutes(addMinutes(now, LEAD_MINUTES))
  const bookingAt = (t: Date) => booked.find((b) => t >= b.from && t < b.to) ?? null
  const pickupOk = (t: Date) => t >= earliest && !bookingAt(t)
  // Return: after pick-up, within 30 days, and no later than the start of the next booking.
  const nextBooking = pickup ? booked.filter((b) => b.from > pickup).reduce<Date | null>((m, b) => (!m || b.from < m ? b.from : m), null) : null
  const longest = pickup ? addMinutes(pickup, MAX_TRIP_DAYS * 24 * 60) : null
  const limit = nextBooking && longest ? (nextBooking < longest ? nextBooking : longest) : longest
  const returnOk = (t: Date) => !!pickup && t > pickup && (!limit || t <= limit)
  return { earliest, earliestDay: startOfDay(earliest), bookingAt, nextBooking, limit, pickupOk, returnOk }
}

type Problem = { text: string; fix: { label: string; apply: () => void } | null } | null

/* ------------------------------------------------------------------ Field button */

type TriggerProps = { tab: DateTab; value: string; open: DateTab | null; onOpenChange: (tab: DateTab | null) => void; compact?: boolean; className?: string }

/** The PICK-UP or RETURN field value; opens the date panel on its tab. */
export function DateTrigger({ tab, value, open, onOpenChange, compact, className }: TriggerProps) {
  const shown = formatTripDate(value, compact)
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open === tab}
      aria-label={`${tab === 'pickup' ? 'Pick-up' : 'Return'} date and time: ${shown ?? 'not set'}`}
      onClick={() => onOpenChange(open === tab ? null : tab)}
      className={cn('block truncate text-left', className, !shown && 'text-ink-400')}
    >
      {shown ?? 'Add date'}
    </button>
  )
}

/* ------------------------------------------------------------------ Panel */

type PickerProps = {
  /** Which tab is open, or null when closed. */
  open: DateTab | null
  onOpenChange: (tab: DateTab | null) => void
  /** Local date-times like "2026-11-12T10:00" (the <input type="datetime-local"> format), or "" for none. */
  pickup: string
  ret: string
  onChange: (next: { pickup: string; ret: string }) => void
  /** Times this vehicle is already taken. Fully booked days are struck out. */
  booked?: BookedRange[]
  /** The fields the panel opens from: it lines up under them, and clicks on them don't close it. */
  anchors: RefObject<HTMLElement | null>[]
}

/**
 * "Select dates": two months side by side (one on phones, as a bottom sheet), PICK-UP and RETURN tabs, and a time field
 * for each. The first click picks pick-up, the next picks return. Past days and booked days are struck out.
 */
export function DateRangePicker(props: PickerProps) {
  if (!props.open) return null
  return createPortal(<Panel {...props} tab={props.open} />, document.body)
}

function Panel({ tab, onOpenChange, pickup, ret, onChange, booked = [], anchors }: PickerProps & { tab: DateTab }) {
  const [now] = useState(() => new Date())
  const start = parseLocal(pickup)
  const end = parseLocal(ret)
  const ranges = booked.map((b) => ({ from: new Date(b.from), to: new Date(b.to) })).filter((b) => !Number.isNaN(b.from.getTime()) && !Number.isNaN(b.to.getTime()))
  const rules = rulesFor(now, start, ranges)
  const startDay = start && startOfDay(start)
  const endDay = end && startOfDay(end)
  const minMonth = startOfMonth(rules.earliest)
  const maxMonth = addMonths(minMonth, 24)
  const maxDay = addDays(addMonths(maxMonth, 1), -1)

  const [first, setFirst] = useState(() => (start && start > rules.earliest ? startOfMonth(start) : minMonth))
  const [focus, setFocus] = useState(() => {
    const d = (tab === 'return' && endDay) || startDay || rules.earliestDay
    return d < rules.earliestDay ? rules.earliestDay : d
  })
  const [hover, setHover] = useState<Date | null>(null)
  const pop = useRef<HTMLDivElement>(null)
  const opener = useRef<Element | null>(null)
  const moveFocus = useRef(true)

  useAnchoredPopover(true, anchors, pop, { align: 'center', sheetBelow: 640 })

  const close = (refocus: boolean) => {
    onOpenChange(null)
    if (refocus && opener.current instanceof HTMLElement) opener.current.focus()
  }
  const closeRef = useRef(close)
  useLayoutEffect(() => {
    closeRef.current = close
  })

  // Remember what opened the panel (to give focus back), and stop the page scrolling behind the phone sheet.
  useLayoutEffect(() => {
    // (Skip focus already inside the panel: React's development mode runs this twice.)
    if (!pop.current?.contains(document.activeElement)) opener.current = document.activeElement
    if (!window.matchMedia(PHONE).matches) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Escape closes just the panel (not a dialog behind it); a click elsewhere closes it too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // An open time list handles its own Escape first.
      if (e.key !== 'Escape' || pop.current?.querySelector('[data-time-list-open]')) return
      e.stopPropagation()
      closeRef.current(true)
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (pop.current?.contains(t) || anchors.some((a) => a.current?.contains(t))) return
      closeRef.current(false)
    }
    window.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // On open and after arrow-key moves, put focus on the active day.
  useEffect(() => {
    if (!moveFocus.current) return
    moveFocus.current = false
    pop.current?.querySelector<HTMLButtonElement>(`[data-day="${dayKey(focus)}"]`)?.focus()
  }, [focus, first])

  /**
   * A day click: on the PICK-UP tab (or before the pick-up) it sets pick-up, otherwise it sets return. The time you set
   * is kept as it is; if it doesn't work on the new day, a message under the time says so (nothing changes by itself).
   */
  const pickDay = (day: Date) => {
    if (tab === 'pickup' || !start || !startDay || day < startDay) {
      const p = atTime(day, start ? clockOf(start) : { h: 10, m: 0 })
      const keep = !!end && end > p // a return before the new pick-up no longer makes a trip: choose it again
      onChange({ pickup: toLocalInput(p), ret: keep ? ret : '' })
      onOpenChange('return')
    } else {
      onChange({ pickup, ret: toLocalInput(atTime(day, clockOf(end ?? start))) })
    }
    setHover(null)
  }

  const setPickupAt = (d: Date) => onChange({ pickup: toLocalInput(d), ret })
  const setReturnAt = (d: Date) => onChange({ pickup, ret: toLocalInput(d) })
  const fmt = (d: Date) => d.toLocaleDateString(PH, { weekday: 'short', month: 'short', day: 'numeric' })

  const pickupProblem: Problem = (() => {
    if (!start || !startDay) return null
    if (start < rules.earliest) {
      if (startDay < startOfDay(now)) return { text: 'That day has passed. Choose another day.', fix: null }
      const soonest = ceilMinutes(rules.earliest, 5)
      return { text: 'Pick-up needs to be at least 1 hour from now.', fix: sameDay(soonest, start) ? { label: `Use ${timeLabel(soonest)}`, apply: () => setPickupAt(soonest) } : null }
    }
    const booking = rules.bookingAt(start)
    if (booking) return { text: 'This vehicle is already booked at that time.', fix: sameDay(booking.to, start) ? { label: `Use ${timeLabel(booking.to)}`, apply: () => setPickupAt(booking.to) } : null }
    return null
  })()

  const returnProblem: Problem = (() => {
    if (!start || !end) return null
    if (end <= start) {
      const hourLater = addMinutes(start, 60)
      return { text: `Return needs to be after pick-up (${timeLabel(start)}${sameDay(start, end) ? '' : `, ${fmt(start)}`}).`, fix: { label: `Use ${timeLabel(hourLater)}${sameDay(hourLater, end) ? '' : `, ${fmt(hourLater)}`}`, apply: () => setReturnAt(hourLater) } }
    }
    if (rules.limit && end > rules.limit) {
      const by = rules.limit
      const fix = { label: `Use ${timeLabel(by)}${sameDay(by, end) ? '' : `, ${fmt(by)}`}`, apply: () => setReturnAt(by) }
      return rules.nextBooking && by.getTime() === rules.nextBooking.getTime()
        ? { text: `This vehicle is booked from ${fmt(by)}, ${timeLabel(by)}. Return by then.`, fix }
        : { text: `Trips can be up to ${MAX_TRIP_DAYS} days.`, fix }
    }
    return null
  })()

  const goMonth = (delta: number) => {
    const next = addMonths(first, delta)
    if (monthIndex(next) < monthIndex(minMonth) || monthIndex(next) > monthIndex(maxMonth)) return
    setFirst(next)
    const days = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
    const f = new Date(next.getFullYear(), next.getMonth(), Math.min(focus.getDate(), days))
    setFocus(f < rules.earliestDay ? rules.earliestDay : f)
  }

  const onKeyDown = (e: ReactKeyboardEvent) => {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    let next: Date
    if (e.key in step) next = addDays(focus, step[e.key])
    else if (e.key === 'Home') next = addDays(focus, -focus.getDay())
    else if (e.key === 'End') next = addDays(focus, 6 - focus.getDay())
    else if (e.key === 'PageUp' || e.key === 'PageDown') next = new Date(focus.getFullYear(), focus.getMonth() + (e.key === 'PageUp' ? -1 : 1), Math.min(focus.getDate(), 28))
    else return
    e.preventDefault()
    if (next < rules.earliestDay) next = rules.earliestDay
    if (next > maxDay) next = maxDay
    const visible = window.matchMedia(PHONE).matches ? 1 : 2
    if (monthIndex(next) < monthIndex(first)) setFirst(startOfMonth(next))
    else if (monthIndex(next) > monthIndex(first) + visible - 1) setFirst(addMonths(startOfMonth(next), 1 - visible))
    moveFocus.current = true
    setFocus(next)
  }

  const preview = tab === 'return' && startDay && hover && hover >= startDay ? hover : null
  const days = start && end ? tripDays(pickup, ret) : 0
  const subtitle = start && end ? `${days} day${days === 1 ? '' : 's'} · ${fmt(start)} – ${fmt(end)}` : start ? 'Now choose your return day.' : 'Choose the day you’ll pick up the vehicle.'
  const navBtn = 'flex size-9 items-center justify-center rounded-full text-ink-700 transition-colors hover:bg-line-100 disabled:pointer-events-none disabled:opacity-30'

  return (
    <>
      <div className="fixed inset-0 z-[1090] animate-fade-in bg-ink-900/50 sm:hidden" aria-hidden />
      <div
        ref={pop}
        role="dialog"
        aria-label="Select dates"
        style={{ visibility: 'hidden' }}
        onBlur={(e) => {
          // Tabbing out of the panel closes it. (Focus moving to a date field is that field's click, handled there.)
          const to = e.relatedTarget as Node | null
          if (to && !pop.current?.contains(to) && !anchors.some((a) => a.current?.contains(to))) close(false)
        }}
        className="fixed z-[1100] flex animate-slide-up flex-col overflow-y-auto bg-white p-5 text-ink-900 shadow-pop max-sm:inset-x-0 max-sm:bottom-0 max-sm:max-h-[92dvh] max-sm:rounded-t-3xl max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-h-[calc(100dvh-16px)] sm:w-[min(46rem,calc(100vw-16px))] sm:rounded-3xl sm:border sm:border-line-200 sm:p-6"
      >
        <span className="mx-auto -mt-2 mb-3 h-1 w-10 shrink-0 rounded-full bg-line-200 sm:hidden" aria-hidden />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-tight">Select dates</h2>
            <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>
            {ranges.length > 0 && <p className="mt-0.5 text-xs text-ink-400">Struck-out days are already booked.</p>}
          </div>
          <div className="grid shrink-0 grid-cols-2 rounded-2xl border border-line-200 bg-line-100 p-1 sm:w-80">
            {(['pickup', 'return'] as const).map((t) => {
              const d = t === 'pickup' ? start : end
              const isActive = tab === t
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onOpenChange(t)}
                  className={cn('min-w-0 rounded-xl px-3 py-2 text-left transition', isActive ? 'bg-white shadow-sm ring-2 ring-ink-900' : 'text-ink-400 hover:bg-white/60')}
                >
                  <span className={cn('block text-[10px] font-bold tracking-wider uppercase', isActive ? 'text-ink-900' : 'text-ink-400')}>{t === 'pickup' ? 'Pick-up' : 'Return'}</span>
                  <span className={cn('block truncate text-sm font-semibold', isActive && !d && 'text-ink-500')}>{d ? d.toLocaleDateString(PH, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Add date'}</span>
                  <span className="block truncate text-xs text-ink-500">{d ? timeLabel(d) : '—'}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="relative mt-5" onKeyDown={onKeyDown} onMouseLeave={() => setHover(null)}>
          <button type="button" className={cn(navBtn, 'absolute top-0 left-0 z-[1]')} onClick={() => goMonth(-1)} disabled={monthIndex(first) <= monthIndex(minMonth)} aria-label="Previous month">
            <ChevronLeft className="size-5" />
          </button>
          <button type="button" className={cn(navBtn, 'absolute top-0 right-0 z-[1]')} onClick={() => goMonth(1)} disabled={monthIndex(first) >= monthIndex(maxMonth) - 1} aria-label="Next month">
            <ChevronRight className="size-5" />
          </button>
          <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <MonthGrid
                key={i}
                month={addMonths(first, i)}
                className={i === 1 ? 'hidden sm:block' : undefined}
                rules={rules}
                tab={tab}
                startDay={startDay}
                endDay={preview ?? endDay}
                isPreview={!!preview}
                today={now}
                focus={focus}
                maxDay={maxDay}
                onPick={pickDay}
                onHover={setHover}
              />
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-4 border-t border-line-100 pt-4 sm:grid-cols-2 sm:gap-x-10">
          <TimeField
            label="Pick-up time"
            hint={start ? fmt(start) : undefined}
            value={start ? clockOf(start) : null}
            onChange={(t) => startDay && setPickupAt(atTime(startDay, t))}
            emptyText="Choose a pick-up day first."
            error={pickupProblem?.text}
            fix={pickupProblem?.fix}
            isAllowed={startDay ? (t) => rules.pickupOk(atTime(startDay, t)) : undefined}
          />
          <TimeField
            label="Return time"
            hint={end ? fmt(end) : undefined}
            value={end ? clockOf(end) : null}
            onChange={(t) => endDay && setReturnAt(atTime(endDay, t))}
            emptyText="Choose a return day first."
            error={returnProblem?.text}
            fix={returnProblem?.fix}
            isAllowed={endDay ? (t) => rules.returnOk(atTime(endDay, t)) : undefined}
          />
        </div>

        {/* On phones this row stays pinned to the bottom of the sheet while the calendar scrolls. */}
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-line-100 pt-4 max-sm:sticky max-sm:bottom-0 max-sm:-mx-5 max-sm:-mb-5 max-sm:bg-white max-sm:px-5 max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={!pickup && !ret}
            onClick={() => {
              onChange({ pickup: '', ret: '' })
              onOpenChange('pickup')
            }}
            className="rounded-lg px-1 py-1 text-sm font-semibold text-ink-900 underline underline-offset-4 hover:text-brand disabled:text-ink-400 disabled:no-underline"
          >
            Clear dates
          </button>
          <Button variant="dark" onClick={() => close(true)}>
            Close
          </Button>
        </div>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ One month */

type MonthProps = {
  month: Date
  className?: string
  rules: ReturnType<typeof rulesFor>
  tab: DateTab
  startDay: Date | null
  endDay: Date | null
  isPreview: boolean
  today: Date
  focus: Date
  maxDay: Date
  onPick: (day: Date) => void
  onHover: (day: Date | null) => void
}

function MonthGrid({ month, className, rules, tab, startDay, endDay, isPreview, today, focus, maxDay, onPick, onHover }: MonthProps) {
  const start = addDays(month, -month.getDay())
  const weeks = Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)))
  const span = !!startDay && !!endDay && endDay > startDay

  return (
    <div className={className}>
      <p className="flex h-9 items-center justify-center text-base font-bold">{month.toLocaleDateString(PH, { month: 'long', year: 'numeric' })}</p>
      <table role="grid" className="mt-2 w-full table-fixed border-collapse" aria-label={month.toLocaleDateString(PH, { month: 'long', year: 'numeric' })}>
        <thead>
          <tr>
            {WEEKDAYS.map((d) => (
              <th key={d.getDay()} scope="col" className="h-8 text-center text-xs font-semibold text-ink-500">
                <span aria-hidden>{d.toLocaleDateString(PH, { weekday: 'narrow' })}</span>
                <span className="sr-only">{d.toLocaleDateString(PH, { weekday: 'long' })}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0].getTime()}>
              {week.map((day) => {
                if (day.getMonth() !== month.getMonth()) return <td key={day.getTime()} className="p-0" />
                // Struck out: in the past, or no pick-up time left that day because it's booked.
                const struck = day < rules.earliestDay || !slotsOf(day).some(rules.pickupOk)
                const setsPickup = tab === 'pickup' || !startDay || day < startDay
                const selectable = !struck && day <= maxDay && slotsOf(day).some(setsPickup ? rules.pickupOk : rules.returnOk)
                const isStart = sameDay(day, startDay)
                const isEnd = sameDay(day, endDay)
                const between = span && day > startDay! && day < endDay!
                const isToday = sameDay(day, today)
                return (
                  <td key={day.getTime()} className="p-0 py-0.5" aria-selected={isStart || (isEnd && !isPreview) || undefined}>
                    <div
                      className={cn(
                        between && 'bg-brand-tint',
                        span && isStart && 'bg-linear-to-r from-transparent from-50% to-brand-tint to-50%',
                        span && isEnd && 'bg-linear-to-l from-transparent from-50% to-brand-tint to-50%',
                      )}
                    >
                      <button
                        type="button"
                        data-small-target
                        data-day={dayKey(day)}
                        tabIndex={sameDay(day, focus) ? 0 : -1}
                        disabled={!selectable}
                        onClick={() => onPick(day)}
                        onMouseEnter={() => onHover(selectable ? day : null)}
                        onFocus={() => onHover(selectable ? day : null)}
                        aria-label={`${day.toLocaleDateString(PH, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}${isToday ? ', today' : ''}${struck && day >= rules.earliestDay ? ', booked' : ''}`}
                        aria-current={isToday ? 'date' : undefined}
                        className={cn(
                          'relative mx-auto flex aspect-square w-full max-w-11 items-center justify-center rounded-full text-sm font-semibold tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand sm:max-w-10',
                          selectable ? 'text-ink-900 hover:ring-2 hover:ring-ink-900 hover:ring-inset' : 'cursor-not-allowed text-ink-400',
                          struck && 'font-medium line-through decoration-ink-400',
                          between && 'text-brand-dark',
                          (isStart || (isEnd && !isPreview)) && 'bg-brand text-white hover:ring-0',
                          isEnd && isPreview && !isStart && 'ring-2 ring-ink-900 ring-inset',
                        )}
                      >
                        {day.getDate()}
                        {isToday && !isStart && !isEnd && <span className="absolute bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-brand" aria-hidden />}
                      </button>
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
