import type { ReactNode } from 'react'
import { Menu } from 'lucide-react'
import { NotificationBell } from './NotificationBell'

export function DashboardTopbar({ title, subtitle, onMenu, action }: { title: string; subtitle?: string; onMenu: () => void; action?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line-200 bg-white/95 px-4 backdrop-blur sm:px-6">
      <button onClick={onMenu} className="-ml-1 rounded-lg p-2 text-ink-700 lg:hidden" aria-label="Open menu">
        <Menu className="size-5" />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-bold text-ink-900 sm:text-lg">{title}</h1>
        {subtitle && <p className="hidden truncate text-xs text-ink-500 sm:block">{subtitle}</p>}
      </div>
      <NotificationBell />
      {action}
    </header>
  )
}
