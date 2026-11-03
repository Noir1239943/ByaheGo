import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

type FieldShellProps = { label?: ReactNode; error?: string; hint?: ReactNode; id: string; className?: string; children: ReactNode; optional?: boolean }

export function FieldShell({ label, error, hint, id, className, children, optional }: FieldShellProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-ink-700">
          {label}
          {optional && <span className="ml-1 font-normal text-ink-400">(optional)</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-ink-500">{hint}</p>
      )}
    </div>
  )
}

const control =
  'w-full rounded-xl border border-line-200 bg-white px-3.5 text-sm text-ink-900 placeholder:text-ink-400 transition focus:border-brand focus:ring-4 focus:ring-brand/10 focus:outline-none disabled:bg-line-100 disabled:text-ink-500'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode
  error?: string
  hint?: ReactNode
  leftIcon?: ReactNode
  rightSlot?: ReactNode
  wrapperClassName?: string
  optional?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, leftIcon, rightSlot, className, wrapperClassName, id, optional, ...rest },
  ref,
) {
  const auto = useId()
  const inputId = id ?? auto
  return (
    <FieldShell label={label} error={error} hint={hint} id={inputId} className={wrapperClassName} optional={optional}>
      <div className="relative">
        {leftIcon && <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-400 [&>svg]:size-4">{leftIcon}</span>}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error || undefined}
          className={cn(control, 'h-11', leftIcon && 'pl-10', rightSlot && 'pr-12', error && 'border-danger focus:border-danger focus:ring-danger/10', className)}
          {...rest}
        />
        {rightSlot && <span className="absolute top-1/2 right-2 -translate-y-1/2">{rightSlot}</span>}
      </div>
    </FieldShell>
  )
})

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: ReactNode; error?: string; hint?: ReactNode; wrapperClassName?: string; optional?: boolean }

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ label, error, hint, className, wrapperClassName, id, optional, ...rest }, ref) {
  const auto = useId()
  const inputId = id ?? auto
  return (
    <FieldShell label={label} error={error} hint={hint} id={inputId} className={wrapperClassName} optional={optional}>
      <textarea ref={ref} id={inputId} aria-invalid={!!error || undefined} className={cn(control, 'min-h-24 py-3', error && 'border-danger', className)} {...rest} />
    </FieldShell>
  )
})

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: ReactNode
  error?: string
  hint?: ReactNode
  options: { value: string | number; label: string }[]
  placeholder?: string
  wrapperClassName?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ label, error, hint, options, placeholder, className, wrapperClassName, id, ...rest }, ref) {
  const auto = useId()
  const inputId = id ?? auto
  return (
    <FieldShell label={label} error={error} hint={hint} id={inputId} className={wrapperClassName}>
      <div className="relative">
        <select ref={ref} id={inputId} aria-invalid={!!error || undefined} className={cn(control, 'h-11 appearance-none pr-10', error && 'border-danger', className)} {...rest}>
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-ink-400" />
      </div>
    </FieldShell>
  )
})
