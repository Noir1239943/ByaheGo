import type { ReactNode } from 'react'
import { Button, type ButtonProps } from '@/components/ui'
import { cn } from '@/lib/cn'

/**
 * The white card shared by the log-in and sign-up pages: a big uppercase title, a grey subtitle, and the content centred
 * and a little narrower than the card.
 */
export function AuthCard({ title, subtitle, wide, children }: { title: string; subtitle?: ReactNode; wide?: boolean; children: ReactNode }) {
  return (
    <section className={cn('w-full animate-slide-up rounded-[28px] bg-white px-6 py-8 shadow-pop sm:px-10 sm:py-10', wide ? 'max-w-xl' : 'max-w-[440px]')}>
      <div className={cn('mx-auto w-full', wide ? 'max-w-md' : 'max-w-[340px]')}>
        <h1 className="text-center text-3xl font-extrabold tracking-[0.06em] text-ink-900 uppercase sm:text-[2rem]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-center text-sm text-ink-500">{subtitle}</p>}
        {children}
      </div>
    </section>
  )
}

/** Input classes for the auth cards: no border, a soft green fill, white on focus. A field with an error gets a red outline instead. */
export function softField(error?: string) {
  return cn(
    'h-12 rounded-2xl border-transparent bg-brand-soft/55 placeholder:text-ink-500 focus:border-brand/40 focus:bg-white',
    error && 'border-danger bg-danger-soft/50 focus:border-danger',
  )
}

/** The centred pill button with a green gradient and a soft shadow ("Login Now", "Sign Up Now"). */
export function PillSubmit({ className, ...rest }: Omit<ButtonProps, 'type'>) {
  return (
    <div className="flex justify-center">
      <Button
        type="submit"
        size="lg"
        className={cn(
          'h-12 min-w-44 rounded-full bg-linear-to-r from-brand to-[#1AA88F] px-10 text-white transition-all',
          'shadow-[0_12px_24px_-10px_rgb(13_124_107/0.8)] hover:-translate-y-px hover:from-brand-dark hover:to-brand hover:shadow-[0_16px_28px_-10px_rgb(13_124_107/0.9)]',
          className,
        )}
        {...rest}
      />
    </div>
  )
}
