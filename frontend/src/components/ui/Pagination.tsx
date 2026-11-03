import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { PageMeta } from '@/types'

function pages(current: number, last: number): (number | '…')[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1)
  const out: (number | '…')[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(last - 1, current + 1)
  if (start > 2) out.push('…')
  for (let i = start; i <= end; i++) out.push(i)
  if (end < last - 1) out.push('…')
  out.push(last)
  return out
}

export function Pagination({ meta, onChange, className, label = 'results' }: { meta: PageMeta; onChange: (page: number) => void; className?: string; label?: string }) {
  if (meta.total === 0) return null
  const from = meta.from ?? (meta.current_page - 1) * meta.per_page + 1
  const to = meta.to ?? Math.min(meta.total, meta.current_page * meta.per_page)
  return (
    <div className={cn('flex flex-col items-center justify-between gap-3 sm:flex-row', className)}>
      <p className="text-sm text-ink-500">
        Showing <span className="font-semibold text-ink-900">{from}–{to}</span> of <span className="font-semibold text-ink-900">{meta.total.toLocaleString()}</span> {label}
      </p>
      {meta.last_page > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button
            className="flex size-9 items-center justify-center rounded-lg text-ink-700 hover:bg-line-100 disabled:opacity-40"
            onClick={() => onChange(meta.current_page - 1)}
            disabled={meta.current_page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </button>
          {pages(meta.current_page, meta.last_page).map((p, i) =>
            p === '…' ? (
              <span key={`e${i}`} className="px-1 text-ink-400">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onChange(p)}
                aria-current={p === meta.current_page ? 'page' : undefined}
                className={cn('size-9 rounded-lg text-sm font-semibold', p === meta.current_page ? 'bg-brand text-white' : 'text-ink-700 hover:bg-line-100')}
              >
                {p}
              </button>
            ),
          )}
          <button
            className="flex size-9 items-center justify-center rounded-lg text-ink-700 hover:bg-line-100 disabled:opacity-40"
            onClick={() => onChange(meta.current_page + 1)}
            disabled={meta.current_page >= meta.last_page}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </button>
        </nav>
      )}
    </div>
  )
}
