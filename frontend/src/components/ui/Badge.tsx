import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const tones = {
  brand: 'bg-brand-soft text-brand-dark',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  neutral: 'bg-line-100 text-ink-700',
  accent: 'bg-accent-soft text-[#9A6400]',
  dark: 'bg-ink-900 text-white',
  white: 'bg-white/95 text-ink-900 shadow-sm',
}

export type BadgeTone = keyof typeof tones

export function Badge({ tone = 'neutral', dot, className, children, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; dot?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap', tones[tone], className)} {...rest}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  )
}
