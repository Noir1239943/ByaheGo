import { Outlet } from 'react-router'
import { SiteFooter } from '@/components/common/SiteFooter'
import { SiteHeader } from '@/components/common/SiteHeader'

export default function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}
