import { useState } from 'react'
import { Outlet } from 'react-router'
import { DashboardSidebar, type NavGroup } from '@/components/common/DashboardSidebar'
import { DashboardTopbar } from '@/components/common/DashboardTopbar'
import { useRouteHandle } from '@/hooks/useRouteHandle'
import type { ReactNode } from 'react'

type Props = { groups: NavGroup[]; badge: string; accountLabel: string; action?: ReactNode }

/** Shared shell for the host dashboard and admin panel: sidebar + top bar. */
export default function DashboardLayout({ groups, badge, accountLabel, action }: Props) {
  const [open, setOpen] = useState(false)
  const handle = useRouteHandle()
  return (
    <div className="min-h-screen bg-page">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">
        <DashboardSidebar groups={groups} badge={badge} accountLabel={accountLabel} />
      </aside>
      {open && (
        <div className="fixed inset-0 z-[1000] lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-ink-900/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 animate-slide-in">
            <DashboardSidebar groups={groups} badge={badge} accountLabel={accountLabel} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
      <div className="lg:pl-64">
        <DashboardTopbar title={handle.title ?? ''} subtitle={handle.subtitle} onMenu={() => setOpen(true)} action={action} />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
