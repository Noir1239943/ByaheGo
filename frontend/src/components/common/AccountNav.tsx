import { NavLink } from 'react-router'
import { Bell, LogOut, ShieldCheck } from 'lucide-react'
import { Avatar } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/cn'
import { useAccountLinks } from '@/hooks/useAccountLinks'

export function AccountNav() {
  const { user, logout } = useAuth()
  const { links, extra } = useAccountLinks()
  if (!user) return null
  const items = [...links, { to: '/account/notifications', label: 'Notifications', icon: Bell }, ...extra]
  const link = ({ isActive }: { isActive: boolean }) =>
    cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium whitespace-nowrap transition', isActive ? 'bg-brand-tint text-brand-dark' : 'text-ink-700 hover:bg-page')
  return (
    <>
      {/* Mobile: horizontal scroller */}
      <nav className="scrollbar-none -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 lg:hidden">
        {items.map((l) => (
          <NavLink key={l.to} to={l.to} className={({ isActive }) => cn('shrink-0 rounded-full border px-3.5 py-2 text-sm font-semibold', isActive ? 'border-brand bg-brand-tint text-brand-dark' : 'border-line-200 bg-white text-ink-700')}>
            {l.label}
          </NavLink>
        ))}
      </nav>
      {/* Desktop: sidebar card */}
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="sticky top-24 rounded-2xl border border-line-200 bg-white p-3 shadow-card">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar initials={user.initials} seed={user.id} />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{user.name}</p>
              <p className="truncate text-xs text-ink-500">{user.email}</p>
            </div>
          </div>
          {user.verification_status !== 'verified' && (
            <NavLink to="/verify" className="mt-1 flex items-center gap-2 rounded-xl bg-accent-soft px-3 py-2 text-xs font-semibold">
              <ShieldCheck className="size-4 text-warning" /> {user.verification_status === 'pending' ? 'Verification in review' : 'Verify your identity'}
            </NavLink>
          )}
          <nav className="mt-2 space-y-0.5">
            {items.map((l) => (
              <NavLink key={l.to} to={l.to} className={link}>
                <l.icon className="size-4" /> {l.label}
              </NavLink>
            ))}
            <button onClick={() => void logout()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-700 hover:bg-page">
              <LogOut className="size-4" /> Sign out
            </button>
          </nav>
        </div>
      </aside>
    </>
  )
}
