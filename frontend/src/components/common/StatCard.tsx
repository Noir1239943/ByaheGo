import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function StatCard({ icon, label, value, sub, className, tone = 'brand' }: { icon?: ReactNode; label: string; value: ReactNode; sub?: ReactNode; className?: string; tone?: 'brand' | 'accent' | 'info' | 'danger' }) {
  const tones = { brand: 'bg-brand-tint text-brand', accent: 'bg-accent-soft text-warning', info: 'bg-info-soft text-info', danger: 'bg-danger-soft text-danger' }
  return (
    <div className={cn('rounded-2xl border border-line-200 bg-white p-5 shadow-card', className)}>
      {icon && <span className={cn('mb-3 flex size-9 items-center justify-center rounded-xl [&>svg]:size-4.5', tones[tone])}>{icon}</span>}
      <p className="text-xs font-medium text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight text-ink-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-500">{sub}</p>}
    </div>
  )
}
