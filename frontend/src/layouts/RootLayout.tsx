import { Outlet, ScrollRestoration } from 'react-router'
import { InstallBanner } from '@/components/common/InstallBanner'
import { TitleManager } from '@/components/common/TitleManager'

export default function RootLayout() {
  return (
    <>
      <TitleManager />
      <ScrollRestoration />
      <Outlet />
      <InstallBanner />
    </>
  )
}
