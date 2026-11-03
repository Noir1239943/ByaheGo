import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function InfoRow({ icon, label, value, className }: { icon?: ReactNode; label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start gap-3', className)}>
      {icon && <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand [&>svg]:size-4">{icon}</span>}
      <div className="min-w-0">
        <p className="text-xs text-ink-500">{label}</p>
        <div className="text-sm font-semibold text-ink-900">{value}</div>
      </div>
    </div>
  )
}

export function KeyValue({ label, value, className, strong }: { label: ReactNode; value: ReactNode; className?: string; strong?: boolean }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 py-1.5 text-sm', className)}>
      <span className="text-ink-500">{label}</span>
      <span className={cn('text-right text-ink-900', strong ? 'font-bold' : 'font-medium')}>{value}</span>
    </div>
  )
}
