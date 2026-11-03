import { useQuery } from '@tanstack/react-query'
import { BadgeCheck, CalendarCheck, Car, CreditCard, Gavel, Headset, LayoutDashboard, Settings, Store, Users, Wallet } from 'lucide-react'
import { adminService } from '@/services/admin'
import DashboardLayout from './DashboardLayout'

export default function AdminLayout() {
  const { data } = useQuery({ queryKey: ['admin', 'overview', '30d'], queryFn: () => adminService.overview('30d'), staleTime: 30000 })
  const a = data?.attention
  const groups = [
    { items: [{ to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true }, { to: '/admin/bookings', label: 'Bookings', icon: CalendarCheck }] },
    {
      title: 'Finance',
      items: [
        { to: '/admin/payments', label: 'Payments & refunds', icon: CreditCard },
        { to: '/admin/payouts', label: 'Payouts', icon: Wallet, badge: a?.payouts },
      ],
    },
    {
      title: 'Trust & safety',
      items: [
        { to: '/admin/verifications', label: 'ID verifications', icon: BadgeCheck, badge: a?.verifications },
        { to: '/admin/listings', label: 'Listings', icon: Car, badge: a?.listings },
        { to: '/admin/host-applications', label: 'Host applications', icon: Store, badge: a?.host_applications },
        { to: '/admin/disputes', label: 'Disputes', icon: Gavel, badge: a?.disputes },
        { to: '/admin/users', label: 'Users', icon: Users },
      ],
    },
    {
      title: 'Platform',
      items: [
        { to: '/admin/support', label: 'Support inbox', icon: Headset, badge: a?.support },
        { to: '/admin/settings', label: 'Settings', icon: Settings },
      ],
    },
  ]
  return <DashboardLayout groups={groups} badge="ADMIN" accountLabel="Super admin" />
}
