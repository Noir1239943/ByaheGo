import type { ButtonHTMLAttributes } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

export function Chip({ active, className, children, showCheck, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; showCheck?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition',
        active ? 'border-brand bg-brand-tint text-brand-dark' : 'border-line-200 bg-white text-ink-700 hover:border-ink-400',
        className,
      )}
      {...rest}
    >
      {showCheck && active && <Check className="size-3.5" strokeWidth={3} />}
      {children}
    </button>
  )
}
