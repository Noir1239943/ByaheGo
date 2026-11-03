import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { Download, Map, Menu, ShieldCheck } from 'lucide-react'
import { Avatar, Button, Drawer } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { cn } from '@/lib/cn'
import { Logo } from './Logo'
import { NotificationBell } from './NotificationBell'
import { SearchPill } from './SearchBar'
import { useAccountLinks } from '@/hooks/useAccountLinks'
import { UserMenu } from './UserMenu'

export function SiteHeader() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const { links, extra } = useAccountLinks()
  const { canInstall, install } = useInstallPrompt()
  const showSearch = pathname !== '/'

  const hostLink = user?.role === 'host' || user?.role === 'admin' ? { to: user.role === 'admin' ? '/admin' : '/host', label: user.role === 'admin' ? 'Admin panel' : 'Host dashboard' } : { to: '/become-a-host', label: 'List your vehicle' }

  return (
    <header className="sticky top-0 z-40 border-b border-line-200 bg-white/95 backdrop-blur">
      <div className="container-page flex h-16 items-center gap-4">
        <button className="-ml-2 rounded-lg p-2 text-ink-700 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu className="size-5" />
        </button>
        <Logo />
        <nav className="ml-4 hidden items-center gap-1 xl:flex">
          {[
            { to: '/vehicles', label: 'Browse' },
            { to: '/vehicles?view=map', label: 'Live map' },
            { to: '/how-it-works', label: 'How it works' },
          ].map((l) => (
            <NavLink key={l.to} to={l.to} end className={({ isActive }) => cn('rounded-lg px-3 py-2 text-sm font-semibold transition', isActive ? 'text-brand' : 'text-ink-700 hover:text-ink-900')}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        {showSearch && <SearchPill className="mx-auto hidden w-full max-w-md md:flex" />}
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <Link to={hostLink.to} className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-brand hover:bg-brand-tint lg:block">
            {hostLink.label}
          </Link>
          {user ? (
            <>
              {user.verification_status !== 'verified' && (
                <Link to="/verify" className="hidden items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-xs font-semibold text-ink-900 sm:inline-flex">
                  <ShieldCheck className="size-3.5 text-warning" /> {user.verification_status === 'pending' ? 'ID in review' : 'Verify ID'}
                </Link>
              )}
              <NotificationBell />
              <UserMenu />
            </>
          ) : (
            <>
              <Button variant="secondary" size="sm" to="/login" className="hidden sm:inline-flex">
                Log in
              </Button>
              <Button size="sm" to="/register">
                Sign up
              </Button>
            </>
          )}
        </div>
      </div>
      {showSearch && (
        <div className="container-page pb-3 md:hidden">
          <SearchPill className="w-full" />
        </div>
      )}

      <Drawer open={open} onClose={() => setOpen(false)} title={<Logo to="/" />}>
        <div className="flex flex-col p-3" onClick={() => setOpen(false)}>
          {user && (
            <div className="mb-2 flex items-center gap-3 rounded-2xl bg-page p-3">
              <Avatar initials={user.initials} seed={user.id} />
              <div className="min-w-0">
                <p className="truncate font-bold">{user.name}</p>
                <p className="truncate text-xs text-ink-500">{user.email}</p>
              </div>
            </div>
          )}
          {[
            { to: '/', label: 'Home' },
            { to: '/vehicles', label: 'Browse vehicles' },
            { to: '/vehicles?view=map', label: 'Live availability map', icon: Map },
            { to: '/how-it-works', label: 'How it works' },
            { to: hostLink.to, label: hostLink.label },
          ].map((l) => (
            <Link key={l.to + l.label} to={l.to} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-900 hover:bg-page">
              {l.label}
            </Link>
          ))}
          <div className="my-2 border-t border-line-100" />
          {user ? (
            <>
              {user.verification_status !== 'verified' && (
                <Link to="/verify" className="rounded-xl px-3 py-2.5 text-sm font-semibold text-warning hover:bg-page">
                  Verify your identity
                </Link>
              )}
              {[...links, ...extra].map((l) => (
                <Link key={l.to} to={l.to} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-700 hover:bg-page">
                  <l.icon className="size-4 text-ink-500" /> {l.label}
                </Link>
              ))}
              <button onClick={() => void logout()} className="mt-1 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-danger hover:bg-page">
                Sign out
              </button>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2 px-1">
              <Button variant="secondary" to="/login">
                Log in
              </Button>
              <Button to="/register">Sign up</Button>
            </div>
          )}
          {canInstall && (
            <button onClick={() => void install()} className="mt-3 flex items-center gap-2 rounded-xl bg-brand-tint px-3 py-3 text-sm font-semibold text-brand-dark">
              <Download className="size-4" /> Install the ByaheGo app
            </button>
          )}
        </div>
      </Drawer>
    </header>
  )
}
