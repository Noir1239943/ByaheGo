import type { ComponentType } from 'react'
import { NavLink } from 'react-router'
import { ChevronRight, Home } from 'lucide-react'
import { Avatar } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/cn'
import { Logo } from './Logo'

export type NavGroup = { title?: string; items: { to: string; label: string; icon: ComponentType<{ className?: string }>; end?: boolean; badge?: number }[] }

export function DashboardSidebar({ groups, badge, onNavigate, accountLabel }: { groups: NavGroup[]; badge: string; onNavigate?: () => void; accountLabel: string }) {
  const { user } = useAuth()
  return (
    <div className="flex h-full flex-col bg-hero text-white">
      <div className="flex h-16 items-center px-5">
        <Logo variant="dark" badge={badge} to={badge === 'ADMIN' ? '/admin' : '/host'} />
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-3" onClick={onNavigate}>
        {groups.map((g, i) => (
          <div key={g.title ?? i}>
            {g.title && <p className="mb-1.5 px-3 text-[10px] font-bold tracking-[0.16em] text-white/45 uppercase">{g.title}</p>}
            <div className="space-y-0.5">
              {g.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition', isActive ? 'bg-white/12 text-white' : 'text-white/70 hover:bg-white/6 hover:text-white')}
                >
                  {({ isActive }) => (
                    <>
                      <item.icon className={cn('size-4.5', isActive && 'text-accent')} />
                      <span className="flex-1">{item.label}</span>
                      {!!item.badge && <span className="rounded-full bg-accent px-1.5 text-[11px] font-bold text-ink-900">{item.badge}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
        <div>
          <NavLink to="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/70 hover:bg-white/6 hover:text-white">
            <Home className="size-4.5" /> Back to ByaheGo
          </NavLink>
        </div>
      </nav>
      {user && (
        <NavLink to="/account/profile" className="m-3 flex items-center gap-3 rounded-2xl bg-white/6 p-3 hover:bg-white/10">
          <Avatar initials={user.initials} size="sm" seed={user.id} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="text-xs text-white/55">{accountLabel}</p>
          </div>
          <ChevronRight className="size-4 text-white/50" />
        </NavLink>
      )}
    </div>
  )
}
