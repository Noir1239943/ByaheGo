import { CalendarCheck, Clock3, Headset, Heart, LayoutDashboard, ReceiptText, ShieldCheck, Store, User as UserIcon } from 'lucide-react'
import { useAuth } from './useAuth'

/** Links shown in the account menu, mobile drawer and account sidebar. */
export function useAccountLinks() {
  const { user } = useAuth()
  const links = [
    { to: '/account/profile', label: 'Profile & settings', icon: UserIcon },
    { to: '/account/trips', label: 'My trips', icon: CalendarCheck },
    { to: '/account/saved', label: 'Saved vehicles', icon: Heart },
    { to: '/account/recently-viewed', label: 'Recently viewed', icon: Clock3 },
    { to: '/account/billing', label: 'Payments & billing', icon: ReceiptText },
  ]
  const extra = [
    user?.role === 'admin'
      ? { to: '/admin', label: 'Admin panel', icon: ShieldCheck }
      : user?.role === 'host'
        ? { to: '/host', label: 'Host dashboard', icon: LayoutDashboard }
        : { to: '/account/host-application', label: 'Become a host', icon: Store },
    { to: '/help', label: 'Help center', icon: Headset },
  ]
  return { links, extra }
}
