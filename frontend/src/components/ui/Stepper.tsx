import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

export function Stepper({ steps, current, className, compact }: { steps: string[]; current: number; className?: string; compact?: boolean }) {
  return (
    <ol className={cn('flex items-center gap-2', className)}>
      {steps.map((s, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={s} className={cn('flex items-center gap-2', i < steps.length - 1 && 'flex-1')}>
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                done ? 'bg-brand text-white' : active ? 'bg-ink-900 text-white' : 'border border-line-200 bg-white text-ink-400',
              )}
            >
              {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <span className={cn('text-xs font-semibold whitespace-nowrap', active || done ? 'text-ink-900' : 'text-ink-400', compact && !active && 'hidden sm:inline')}>{s}</span>
            {i < steps.length - 1 && <span className={cn('h-0.5 min-w-4 flex-1 rounded-full', done ? 'bg-brand' : 'bg-line-200')} />}
          </li>
        )
      })}
    </ol>
  )
}
