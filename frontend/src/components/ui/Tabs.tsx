import { cn } from '@/lib/cn'

type Tab<T extends string> = { value: T; label: string; count?: number }

export function Tabs<T extends string>({ tabs, value, onChange, className, variant = 'underline' }: { tabs: Tab<T>[]; value: T; onChange: (v: T) => void; className?: string; variant?: 'underline' | 'pill' }) {
  if (variant === 'pill') {
    return (
      <div className={cn('scrollbar-none flex gap-2 overflow-x-auto', className)} role="tablist">
        {tabs.map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={value === t.value}
            onClick={() => onChange(t.value)}
            className={cn(
              'h-9 shrink-0 rounded-full border px-4 text-sm font-semibold transition',
              value === t.value ? 'border-ink-900 bg-ink-900 text-white' : 'border-line-200 bg-white text-ink-700 hover:border-ink-400',
            )}
          >
            {t.label}
            {t.count !== undefined && <span className={cn('ml-1.5', value === t.value ? 'text-white/70' : 'text-ink-400')}>{t.count.toLocaleString()}</span>}
          </button>
        ))}
      </div>
    )
  }
  return (
    <div className={cn('scrollbar-none flex gap-6 overflow-x-auto border-b border-line-200', className)} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn('-mb-px shrink-0 border-b-2 pb-3 text-sm font-semibold transition', value === t.value ? 'border-brand text-brand' : 'border-transparent text-ink-500 hover:text-ink-900')}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 rounded-full bg-line-100 px-1.5 py-0.5 text-xs text-ink-500">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Segmented<T extends string>({ options, value, onChange, className }: { options: { value: T; label: string; sub?: string }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cn('grid gap-1 rounded-xl bg-line-100 p-1', className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn('rounded-lg px-3 py-2 text-sm font-semibold transition', value === o.value ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-900')}
        >
          {o.label}
          {o.sub && <span className={cn('block text-[11px] font-medium', value === o.value ? 'text-brand' : 'text-ink-400')}>{o.sub}</span>}
        </button>
      ))}
    </div>
  )
}
