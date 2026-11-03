import { cn } from '@/lib/cn'

const sizes = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-lg', xl: 'size-20 text-2xl' }
const palette = ['bg-brand-soft text-brand-dark', 'bg-accent-soft text-[#9A6400]', 'bg-info-soft text-info', 'bg-success-soft text-success', 'bg-line-100 text-ink-700']

export function Avatar({ initials, size = 'md', className, seed }: { initials: string; size?: keyof typeof sizes; className?: string; seed?: number }) {
  const tone = palette[(seed ?? initials.charCodeAt(0)) % palette.length]
  return <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-bold', sizes[size], tone, className)}>{initials}</span>
}
