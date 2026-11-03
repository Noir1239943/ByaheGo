import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: ReactNode; description?: ReactNode; error?: string }

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox({ label, description, error, className, id, ...rest }, ref) {
  const auto = useId()
  const inputId = id ?? auto
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={inputId} className="flex cursor-pointer items-start gap-3 text-sm text-ink-700">
        <input ref={ref} id={inputId} type="checkbox" className="mt-0.5 size-4.5 shrink-0 cursor-pointer rounded accent-brand" {...rest} />
        <span>
          <span className="font-medium text-ink-900">{label}</span>
          {description && <span className="mt-0.5 block text-xs text-ink-500">{description}</span>}
        </span>
      </label>
      {error && <p className="ml-7 text-xs font-medium text-danger">{error}</p>}
    </div>
  )
})
