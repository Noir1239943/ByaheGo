import { Outlet, ScrollRestoration } from 'react-router'
import { InstallBanner } from '@/components/common/InstallBanner'
import { PwaStatus } from '@/components/common/PwaStatus'
import { TitleManager } from '@/components/common/TitleManager'

export default function RootLayout() {
  return (
    <>
      <TitleManager />
      <ScrollRestoration />
      <Outlet />
      <InstallBanner />
      <PwaStatus />
    </>
  )
}
