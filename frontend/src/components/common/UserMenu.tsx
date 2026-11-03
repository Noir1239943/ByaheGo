import { Link, useNavigate } from 'react-router'
import { ChevronDown, Download, LogOut, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, Dropdown } from '@/components/ui'
import { useAccountLinks } from '@/hooks/useAccountLinks'
import { useAuth } from '@/hooks/useAuth'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { cn } from '@/lib/cn'


export function UserMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { links, extra } = useAccountLinks()
  const { canInstall, install } = useInstallPrompt()
  if (!user) return null
  return (
    <Dropdown
      className="w-72"
      trigger={(open) => (
        <button className="flex items-center gap-1.5 rounded-full border border-line-200 bg-white py-1 pr-2 pl-1 hover:shadow-sm" aria-label="Account menu">
          <Avatar initials={user.initials} size="sm" seed={user.id} />
          <ChevronDown className={cn('size-4 text-ink-500 transition', open && 'rotate-180')} />
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center gap-3 px-3 py-2.5">
            <Avatar initials={user.initials} seed={user.id} />
            <div className="min-w-0">
              <p className="truncate font-bold">{user.name}</p>
              <p className="truncate text-xs text-ink-500">{user.email}</p>
            </div>
          </div>
          {user.verification_status !== 'verified' && (
            <Link to="/verify" onClick={close} className="mx-1 mb-1 flex items-center gap-2 rounded-xl bg-accent-soft px-3 py-2.5 text-sm">
              <ShieldCheck className="size-4 text-warning" />
              <span>
                <span className="block font-semibold">{user.verification_status === 'pending' ? 'Verification in review' : 'Verify your identity'}</span>
                <span className="block text-xs text-ink-500">{user.verification_status === 'pending' ? 'Usually done within 24 hours' : 'Required to book self-drive trips'}</span>
              </span>
            </Link>
          )}
          <div className="my-1 border-t border-line-100" />
          {[...links, ...extra].map((l) => (
            <Link key={l.to} to={l.to} onClick={close} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-ink-700 hover:bg-page hover:text-ink-900">
              <l.icon className="size-4 text-ink-500" /> {l.label}
            </Link>
          ))}
          {canInstall && (
            <button onClick={() => { close(); void install() }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-ink-700 hover:bg-page">
              <Download className="size-4 text-ink-500" /> Install the ByaheGo app
            </button>
          )}
          <div className="my-1 border-t border-line-100" />
          <button
            onClick={async () => {
              close()
              await logout()
              toast.success('You\'re signed out. See you on your next trip!')
              navigate('/')
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-ink-700 hover:bg-page"
          >
            <LogOut className="size-4 text-ink-500" /> Sign out
          </button>
        </div>
      )}
    </Dropdown>
  )
}
