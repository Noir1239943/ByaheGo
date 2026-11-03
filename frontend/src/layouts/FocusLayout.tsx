import { Link, Outlet } from 'react-router'
import { LifeBuoy } from 'lucide-react'
import { Logo } from '@/components/common/Logo'
import { SiteFooter } from '@/components/common/SiteFooter'

/** Distraction-free layout for step-by-step flows (identity verification, host application). */
export default function FocusLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line-200 bg-white">
        <div className="container-page flex h-16 items-center justify-between">
          <Logo />
          <div className="flex items-center gap-4 text-sm font-semibold">
            <Link to="/help" className="inline-flex items-center gap-1.5 text-ink-500 hover:text-ink-900">
              <LifeBuoy className="size-4" /> Need help?
            </Link>
            <Link to="/account/profile" className="text-brand">
              Save and exit
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}
