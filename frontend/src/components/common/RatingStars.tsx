import { Star } from 'lucide-react'
import { cn } from '@/lib/cn'

export function RatingStars({ value, size = 'sm', className }: { value: number; size?: 'sm' | 'md'; className?: string }) {
  const s = size === 'sm' ? 'size-3.5' : 'size-5'
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn(s, i <= Math.round(value) ? 'fill-accent text-accent' : 'fill-line-200 text-line-200')} />
      ))}
    </span>
  )
}

export function RatingInline({ value, count, className }: { value: number; count?: number; className?: string }) {
  if (!count) return <span className={cn('text-xs font-semibold text-brand', className)}>New</span>
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold text-ink-900', className)}>
      <Star className="size-3.5 fill-accent text-accent" />
      {value.toFixed(1)}
      <span className="font-normal text-ink-400">({count})</span>
    </span>
  )
}
