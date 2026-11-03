import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

type DrawerProps = { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; side?: 'left' | 'right'; className?: string; footer?: ReactNode }

export function Drawer({ open, onClose, title, children, side = 'left', className, footer }: DrawerProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[1000]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 animate-fade-in bg-ink-900/50" onClick={onClose} />
      <div className={cn('absolute top-0 bottom-0 flex w-[86%] max-w-sm flex-col bg-white shadow-pop', side === 'left' ? 'left-0 animate-slide-in' : 'right-0 animate-fade-in', className)}>
        <div className="flex items-center justify-between border-b border-line-100 px-5 py-4">
          <div className="text-base font-bold">{title}</div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-500 hover:bg-line-100" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-line-100 p-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
