import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from 'lucide-react'
import { cn } from '@/lib/cn'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-5 animate-spin text-brand', className)} aria-label="Loading" />
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-line-100', className)} aria-hidden />
}

const alertTones = {
  info: { box: 'bg-info-soft border-info/20 text-ink-700', icon: Info, iconClass: 'text-info' },
  success: { box: 'bg-success-soft border-success/20 text-ink-700', icon: CheckCircle2, iconClass: 'text-success' },
  warning: { box: 'bg-accent-soft border-accent/30 text-ink-700', icon: AlertTriangle, iconClass: 'text-warning' },
  danger: { box: 'bg-danger-soft border-danger/20 text-ink-700', icon: XCircle, iconClass: 'text-danger' },
  brand: { box: 'bg-brand-tint border-brand/15 text-ink-700', icon: Info, iconClass: 'text-brand' },
}

export function Alert({ tone = 'info', title, children, action, className, icon }: { tone?: keyof typeof alertTones; title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string; icon?: ReactNode }) {
  const t = alertTones[tone]
  const Icon = t.icon
  return (
    <div className={cn('flex flex-col gap-3 rounded-2xl border px-4 py-3.5 text-sm sm:flex-row sm:items-center', t.box, className)} role={tone === 'danger' ? 'alert' : 'status'}>
      <div className="flex flex-1 items-start gap-3">
        <span className={cn('mt-0.5 shrink-0 [&>svg]:size-4.5', t.iconClass)}>{icon ?? <Icon />}</span>
        <div className="min-w-0">
          {title && <p className="font-semibold text-ink-900">{title}</p>}
          {children && <div className={cn(title && 'mt-0.5', 'text-ink-700')}>{children}</div>}
        </div>
      </div>
      {action && <div className="shrink-0 sm:ml-2">{action}</div>}
    </div>
  )
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-line-100', className)}>
      <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}
