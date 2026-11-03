import { cn } from '@/lib/cn'
import { compactPeso, peso } from '@/lib/format'

/** Simple accessible bar chart (last bar highlighted), as in the design. */
export function BarChart({ data, className, height = 200 }: { data: { label: string; amount: number }[]; className?: string; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.amount))
  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-end gap-1.5 sm:gap-2.5" style={{ height }} role="img" aria-label="Bar chart of amounts by month">
        {data.map((d, i) => {
          const last = i === data.length - 1
          const h = Math.max(3, (d.amount / max) * 100)
          return (
            <div key={d.label + i} className="group relative flex h-full flex-1 flex-col items-center justify-end">
              {last && <span className="mb-1 text-[11px] font-bold text-brand">{compactPeso(d.amount)}</span>}
              <div className={cn('w-full rounded-t-md transition-all', last ? 'bg-brand' : 'bg-brand-soft group-hover:bg-brand/40')} style={{ height: `${h}%` }} />
              <span className="pointer-events-none absolute -top-8 z-10 hidden rounded-md bg-ink-900 px-2 py-1 text-[11px] font-semibold whitespace-nowrap text-white group-hover:block">
                {d.label}: {peso(d.amount)}
              </span>
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex gap-1.5 sm:gap-2.5">
        {data.map((d, i) => (
          <span key={d.label + i} className="flex-1 text-center text-[11px] text-ink-400">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  )
}
