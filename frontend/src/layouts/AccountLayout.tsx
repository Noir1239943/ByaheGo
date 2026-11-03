import { Outlet } from 'react-router'
import { AccountNav } from '@/components/common/AccountNav'

export default function AccountLayout() {
  return (
    <div className="container-page py-6 lg:py-10">
      <div className="flex flex-col lg:flex-row lg:gap-8">
        <AccountNav />
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
