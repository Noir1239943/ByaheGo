import { CalendarCheck, Car, LayoutDashboard, Plus, Wallet } from 'lucide-react'
import { Button } from '@/components/ui'
import DashboardLayout from './DashboardLayout'

const groups = [
  { items: [{ to: '/host', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
  { title: 'Operations', items: [{ to: '/host/vehicles', label: 'Vehicles', icon: Car }, { to: '/host/bookings', label: 'Bookings', icon: CalendarCheck }] },
  { title: 'Finance', items: [{ to: '/host/earnings', label: 'Earnings', icon: Wallet }] },
]

export default function HostLayout() {
  return (
    <DashboardLayout
      groups={groups}
      badge="HOST"
      accountLabel="Host account"
      action={
        <Button size="sm" to="/host/vehicles/new" icon={<Plus className="size-4" />} className="hidden sm:inline-flex">
          Add vehicle
        </Button>
      }
    />
  )
}
