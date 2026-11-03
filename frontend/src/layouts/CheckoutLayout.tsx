import { Outlet } from 'react-router'
import { Lock } from 'lucide-react'
import { Logo } from '@/components/common/Logo'
import { useRouteHandle } from '@/hooks/useRouteHandle'
import { Stepper } from '@/components/ui'

export default function CheckoutLayout() {
  const handle = useRouteHandle()
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line-200 bg-white/95 backdrop-blur">
        <div className="container-page flex h-16 items-center gap-6">
          <Logo />
          <Stepper steps={['Trip details', 'Driver & payment', 'Confirmed']} current={handle.step ?? 1} className="mx-auto hidden max-w-lg flex-1 md:flex" />
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-brand md:ml-0">
            <Lock className="size-3.5" /> Secure checkout
          </span>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
