import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function SectionHeading({ eyebrow, title, description, action, className, align = 'left' }: { eyebrow?: string; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string; align?: 'left' | 'center' }) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', align === 'center' && 'flex-col items-center text-center', className)}>
      <div className={cn(align === 'center' && 'max-w-2xl')}>
        {eyebrow && <p className="mb-2 text-xs font-bold tracking-[0.14em] text-brand uppercase">{eyebrow}</p>}
        <h2 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">{title}</h2>
        {description && <p className="mt-2 text-sm text-ink-500 sm:text-base">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function PageTitle({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-end justify-between gap-4', className)}>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}
