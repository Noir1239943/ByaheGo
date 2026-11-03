import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

const variants = {
  primary: 'bg-brand text-white hover:bg-brand-dark shadow-sm',
  secondary: 'bg-white text-ink-900 border border-line-200 hover:border-ink-400 hover:bg-page',
  accent: 'bg-accent text-ink-900 hover:bg-accent-dark shadow-sm',
  ghost: 'text-ink-700 hover:bg-line-100',
  dark: 'bg-ink-900 text-white hover:bg-ink-700',
  danger: 'bg-danger text-white hover:bg-danger/90',
  'danger-outline': 'bg-white text-danger border border-danger/40 hover:bg-danger-soft',
  'outline-light': 'border border-white/30 text-white hover:bg-white/10',
  soft: 'bg-brand-soft text-brand-dark hover:bg-brand-soft/70',
}
const sizes = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-11 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-base gap-2 rounded-xl',
  icon: 'h-10 w-10 rounded-xl',
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  loading?: boolean
  to?: string
  icon?: ReactNode
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, to, icon, fullWidth, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  const classes = cn(
    'inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-55',
    variants[variant],
    sizes[size],
    fullWidth && 'w-full',
    className,
  )
  const content = (
    <>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </>
  )
  if (to && !disabled) {
    return (
      <Link to={to} className={classes}>
        {content}
      </Link>
    )
  }
  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {content}
    </button>
  )
})
