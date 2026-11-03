import { useCallback, useRef, useState, type ReactNode } from 'react'
import { useClickOutside } from '@/hooks/useClickOutside'
import { cn } from '@/lib/cn'

export function Dropdown({ trigger, children, align = 'right', className }: { trigger: (open: boolean) => ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right'; className?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useClickOutside(ref, close, open)
  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen((o) => !o)}>{trigger(open)}</div>
      {open && (
        <div className={cn('absolute top-full z-50 mt-2 animate-slide-up rounded-2xl border border-line-200 bg-white p-2 shadow-pop', align === 'right' ? 'right-0' : 'left-0', className)}>
          {children(close)}
        </div>
      )}
    </div>
  )
}
