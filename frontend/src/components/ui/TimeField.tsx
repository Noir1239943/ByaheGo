import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ChevronDown, Clock } from 'lucide-react'
import { cn } from '@/lib/cn'

/** A time of day, 24-hour: { h: 14, m: 5 } is 2:05 PM. */
export type ClockTime = { h: number; m: number }

const pad = (n: number) => String(n).padStart(2, '0')
const hour12 = (h: number) => (h % 12 === 0 ? 12 : h % 12)
const label12 = (t: ClockTime) => `${hour12(t.h)}:${pad(t.m)} ${t.h < 12 ? 'AM' : 'PM'}`
/** Quick choices in the list: every half hour. Any minute can still be typed. */
const QUICK = Array.from({ length: 48 }, (_, i) => ({ h: Math.floor(i / 2), m: (i % 2) * 30 }))

type Props = {
  label: string
  value: ClockTime | null
  onChange: (t: ClockTime) => void
  /** Shown instead of the field until there's a day to set a time on. */
  emptyText?: string
  /** A short problem with the chosen time, shown under the field. */
  error?: string | null
  /** An optional one-click fix offered next to the error, e.g. "Use 9:15 PM". */
  fix?: { label: string; apply: () => void } | null
  /** Greys out times in the quick list that can't be picked. */
  isAllowed?: (t: ClockTime) => boolean
  /** Extra text after the label, e.g. the day. */
  hint?: ReactNode
}

/**
 * Hour : minute AM/PM. Click a part and type ("9", "45", "p"), use the arrow keys, or open the list of half-hour times.
 * Typing 24-hour times works too ("14" becomes 2 PM).
 */
export function TimeField({ label, value, onChange, emptyText, error, fix, isAllowed, hint }: Props) {
  const id = useId()
  const hourRef = useRef<HTMLInputElement>(null)
  const minuteRef = useRef<HTMLInputElement>(null)
  const periodRef = useRef<HTMLButtonElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  // What's half-typed in a box. Mirrored in a ref because moving focus on fires the old box's blur straight away,
  // before React re-renders, and that blur must see the value as it is now.
  const [draft, setDraftState] = useState<{ part: 'h' | 'm'; text: string } | null>(null)
  const draftRef = useRef(draft)
  const setDraft = (d: typeof draft) => {
    draftRef.current = d
    setDraftState(d)
  }
  const [listOpen, setListOpen] = useState(false)

  const t = value ?? { h: 10, m: 0 }
  const pm = t.h >= 12
  const set = (h: number, m: number) => onChange({ h: ((h % 24) + 24) % 24, m: ((m % 60) + 60) % 60 })
  const setHour12 = (h: number) => set((h % 12) + (pm ? 12 : 0), t.m)

  // Escape and clicks outside close the list (and only the list, not the date panel around it).
  useEffect(() => {
    if (!listOpen) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setListOpen(false)
      toggleRef.current?.focus()
    }
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setListOpen(false)
    }
    window.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [listOpen])

  // Open the list at the chosen time (or the first allowed one).
  useLayoutEffect(() => {
    const el = list.current
    if (!listOpen || !el) return
    const target = el.querySelector<HTMLElement>('[aria-selected="true"]') ?? el.querySelector<HTMLElement>('button:not(:disabled)')
    if (target) el.scrollTop = target.offsetTop - el.clientHeight / 2 + target.offsetHeight / 2
  }, [listOpen])

  /** Typing into the hour box: one digit that can't start a bigger hour moves on; two digits always do. */
  const typeHour = (raw: string) => {
    let text = raw.replace(/\D/g, '').slice(-2)
    if (text.length === 2) {
      const n = Number(text)
      if (n >= 1 && n <= 12) setHour12(n)
      else if (n >= 13 && n <= 23) set(n, t.m)
      else if (n === 0 || n === 24) set(0, t.m)
      else text = text.slice(1) // e.g. "35": start again with "5"
      if (text.length === 2) {
        setDraft(null)
        return minuteRef.current?.focus()
      }
    }
    if (text.length === 1) {
      const n = Number(text)
      if (n >= 2) {
        setHour12(n)
        setDraft(null)
        return minuteRef.current?.focus()
      }
    }
    setDraft({ part: 'h', text })
  }

  const typeMinute = (raw: string) => {
    let text = raw.replace(/\D/g, '').slice(-2)
    if (text.length === 2 && Number(text) > 59) text = text.slice(1)
    if (text.length === 2 || (text.length === 1 && Number(text) >= 6)) {
      set(t.h, Number(text))
      setDraft(null)
      return periodRef.current?.focus()
    }
    setDraft({ part: 'm', text })
  }

  /** Leaving a box with a half-typed value ("1" in the hour, "4" in the minute) keeps it. */
  const commitDraft = () => {
    const d = draftRef.current
    if (!d) return
    setDraft(null)
    if (!d.text) return
    const n = Number(d.text)
    if (d.part === 'h' && n >= 1) setHour12(n)
    if (d.part === 'm') set(t.h, n)
  }

  const onPartKey = (part: 'h' | 'm') => (e: KeyboardEvent<HTMLInputElement>) => {
    const step = e.shiftKey ? (part === 'h' ? 1 : 15) : 1
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const d = e.key === 'ArrowUp' ? step : -step
      setDraft(null)
      if (part === 'h') set(t.h + d, t.m)
      else set(t.h, t.m + d)
    } else if (e.key === 'ArrowRight' || e.key === ':' || e.key === ' ') {
      e.preventDefault()
      commitDraft()
      ;(part === 'h' ? minuteRef.current : periodRef.current)?.focus()
    } else if (e.key === 'ArrowLeft' && part === 'm') {
      e.preventDefault()
      commitDraft()
      hourRef.current?.focus()
    } else if (e.key === 'Backspace') {
      e.preventDefault()
      setDraft({ part, text: '' })
    } else if (e.key === 'Enter') {
      commitDraft()
    } else if (/^[ap]$/i.test(e.key)) {
      e.preventDefault()
      const wantPm = e.key.toLowerCase() === 'p'
      if (wantPm !== pm) set(t.h + (wantPm ? 12 : -12), t.m)
    }
  }

  const onPeriodKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const key = e.key.toLowerCase()
    if (key === 'a' || key === 'p') {
      e.preventDefault()
      if ((key === 'p') !== pm) set(t.h + (pm ? -12 : 12), t.m)
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      set(t.h + 12, t.m)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      minuteRef.current?.focus()
    }
  }

  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = [...(list.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    items[Math.max(0, Math.min(items.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus()
  }

  const part = 'h-8 w-8 rounded-md bg-transparent text-center text-base font-semibold tabular-nums text-ink-900 outline-none placeholder:text-ink-400 focus:bg-brand-soft focus:text-brand-dark sm:text-sm'
  const shown = (p: 'h' | 'm') => (draft?.part === p ? draft.text : value ? (p === 'h' ? pad(hour12(t.h)) : pad(t.m)) : '')

  return (
    <div className="min-w-0">
      <p className="mb-2 flex items-baseline gap-1.5 text-xs font-semibold tracking-wide text-ink-500 uppercase" id={`${id}-label`}>
        {label}
        {hint && <span className="font-medium tracking-normal normal-case text-ink-400">· {hint}</span>}
      </p>
      {!value ? (
        <p className="flex h-11 items-center rounded-xl border border-dashed border-line-200 px-3 text-sm text-ink-400">{emptyText}</p>
      ) : (
        <div ref={root} className="relative" data-time-list-open={listOpen || undefined}>
          <div
            role="group"
            aria-labelledby={`${id}-label`}
            aria-describedby={error ? `${id}-error` : undefined}
            className={cn(
              'flex h-11 items-center rounded-xl border bg-white pr-1 pl-3 transition focus-within:ring-4',
              error ? 'border-danger focus-within:ring-danger/10' : 'border-line-200 hover:border-ink-400 focus-within:border-brand focus-within:ring-brand/10',
            )}
          >
            <Clock className="mr-1.5 size-4 shrink-0 text-ink-400" aria-hidden />
            <input
              ref={hourRef}
              data-small-target
              aria-label="Hour"
              inputMode="numeric"
              autoComplete="off"
              maxLength={2}
              placeholder="hh"
              value={shown('h')}
              onFocus={(e) => e.target.select()}
              onMouseUp={(e) => e.preventDefault()}
              onChange={(e) => typeHour(e.target.value)}
              onBlur={commitDraft}
              onKeyDown={onPartKey('h')}
              className={part}
            />
            <span className="px-0.5 font-semibold text-ink-400" aria-hidden>:</span>
            <input
              ref={minuteRef}
              data-small-target
              aria-label="Minute"
              inputMode="numeric"
              autoComplete="off"
              maxLength={2}
              placeholder="mm"
              value={shown('m')}
              onFocus={(e) => e.target.select()}
              onMouseUp={(e) => e.preventDefault()}
              onChange={(e) => typeMinute(e.target.value)}
              onBlur={commitDraft}
              onKeyDown={onPartKey('m')}
              className={part}
            />
            <button
              ref={periodRef}
              type="button"
              data-small-target
              aria-label={`${pm ? 'PM' : 'AM'}, press to switch`}
              onClick={() => set(t.h + 12, t.m)}
              onKeyDown={onPeriodKey}
              className="ml-1 h-8 rounded-md px-1.5 text-base font-semibold text-ink-900 outline-none focus:bg-brand-soft focus:text-brand-dark sm:text-sm"
            >
              {pm ? 'PM' : 'AM'}
            </button>
            <button
              ref={toggleRef}
              type="button"
              aria-haspopup="listbox"
              aria-expanded={listOpen}
              aria-label={`Choose a ${label.toLowerCase()} from a list`}
              onClick={() => setListOpen((o) => !o)}
              className="ml-auto flex size-9 items-center justify-center rounded-lg text-ink-500 hover:bg-line-100 hover:text-ink-900"
            >
              <ChevronDown className={cn('size-4 transition-transform', listOpen && 'rotate-180')} />
            </button>
          </div>
          {listOpen && (
            // Opens upward so it stays inside the date panel (the times sit at its bottom).
            <div ref={list} role="listbox" aria-label={label} onKeyDown={onListKey} className="absolute right-0 bottom-full left-0 z-10 mb-1.5 max-h-56 animate-fade-in overflow-y-auto overscroll-contain rounded-xl border border-line-200 bg-white p-1 shadow-pop">
              {QUICK.map((q) => {
                const selected = q.h === t.h && q.m === t.m
                return (
                  <button
                    key={q.h * 60 + q.m}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={isAllowed ? !isAllowed(q) : false}
                    onClick={() => {
                      onChange(q)
                      setListOpen(false)
                      toggleRef.current?.focus()
                    }}
                    className={cn(
                      'block w-full rounded-lg px-3 py-2 text-left text-sm font-medium tabular-nums',
                      selected ? 'bg-brand text-white' : 'text-ink-900 hover:bg-line-100 focus:bg-line-100 focus:outline-none',
                      'disabled:cursor-not-allowed disabled:text-ink-400 disabled:line-through disabled:hover:bg-transparent',
                    )}
                  >
                    {label12(q)}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
      {value && error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs font-medium text-danger">
          {error}
          {fix && (
            <>
              {' '}
              <button type="button" onClick={fix.apply} className="font-semibold text-brand underline underline-offset-2 hover:text-brand-dark">
                {fix.label}
              </button>
            </>
          )}
        </p>
      )}
    </div>
  )
}
