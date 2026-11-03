import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function EmptyState({ icon, title, description, action, className, art }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode; className?: string; art?: ReactNode }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {art}
      {icon && !art && <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand [&>svg]:size-6">{icon}</div>}
      <h3 className="text-base font-bold text-ink-900">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}
