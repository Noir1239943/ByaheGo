import { Link } from 'react-router'
import mark from '@/assets/logo-mark.png'
import wordmark from '@/assets/logo-wordmark.png'
import { cn } from '@/lib/cn'

type LogoProps = { variant?: 'light' | 'dark'; className?: string; to?: string; size?: 'sm' | 'md' | 'lg'; badge?: string }

/** ByaheGo logo: the app mark with the name. Use variant="dark" on dark backgrounds. */
export function Logo({ variant = 'light', className, to = '/', size = 'md', badge }: LogoProps) {
  const s = { sm: 'size-7', md: 'size-8', lg: 'size-10' }[size]
  const t = { sm: 'text-base', md: 'text-lg', lg: 'text-2xl' }[size]
  return (
    <Link to={to} className={cn('inline-flex items-center gap-2', className)} aria-label="ByaheGo home">
      <img src={mark} alt="" className={cn(s, 'drop-shadow-sm')} width={40} height={40} />
      <span className={cn('font-extrabold tracking-tight', t, variant === 'dark' ? 'text-white' : 'text-ink-900')}>
        Byahe<span className={variant === 'dark' ? 'text-[#3DDC97]' : 'text-brand'}>Go</span>
      </span>
      {badge && <span className="rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-ink-900">{badge}</span>}
    </Link>
  )
}

/** Full wordmark with tagline (for dark backgrounds). */
export function Wordmark({ className }: { className?: string }) {
  return <img src={wordmark} alt="ByaheGo – Your journey, our priority" className={cn('h-auto w-56', className)} width={720} height={179} />
}
