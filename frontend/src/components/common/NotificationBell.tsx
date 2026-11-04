import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import { Bell } from 'lucide-react'
import { Dropdown } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/cn'
import { timeAgo } from '@/lib/format'
import { accountService } from '@/services/account'

const dot = { info: 'bg-info', success: 'bg-success', warning: 'bg-accent', danger: 'bg-danger' }

export function NotificationBell({ className }: { className?: string }) {
  const { unread, refresh } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { data = [], refetch } = useQuery({ queryKey: ['notifications'], queryFn: accountService.notifications, enabled: false })
  // The list is only fetched when the bell is opened (the badge number already comes with /me), not on every page.

  return (
    <Dropdown
      className="w-[min(92vw,360px)] p-0"
      trigger={() => (
        <button onClick={() => void refetch()} className={cn('relative flex size-10 items-center justify-center rounded-full text-ink-700 hover:bg-line-100', className)} aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}>
          <Bell className="size-5" />
          {unread > 0 && <span className="absolute top-1.5 right-1.5 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-line-100 px-4 py-3">
            <p className="font-bold">Notifications</p>
            {unread > 0 && (
              <button
                className="text-xs font-semibold text-brand"
                onClick={async () => {
                  await accountService.readAll()
                  await refresh()
                  void qc.invalidateQueries({ queryKey: ['notifications'] })
                }}
              >
                Mark all as read
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {data.slice(0, 6).map((n) => (
              <li key={n.id}>
                <button
                  className={cn('flex w-full gap-3 px-4 py-3 text-left hover:bg-page', !n.read && 'bg-brand-tint/60')}
                  onClick={async () => {
                    close()
                    if (!n.read) {
                      await accountService.readNotification(n.id)
                      void refresh()
                      void qc.invalidateQueries({ queryKey: ['notifications'] })
                    }
                    if (n.link) navigate(n.link)
                  }}
                >
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-line-200' : dot[n.kind])} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink-900">{n.title}</span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-ink-500">{n.body}</span>
                    <span className="mt-1 block text-[11px] text-ink-400">{timeAgo(n.created_at)}</span>
                  </span>
                </button>
              </li>
            ))}
            {data.length === 0 && <li className="px-4 py-8 text-center text-sm text-ink-500">You're all caught up.</li>}
          </ul>
          <Link to="/account/notifications" onClick={close} className="block border-t border-line-100 px-4 py-3 text-center text-sm font-semibold text-brand hover:bg-page">
            See all notifications
          </Link>
        </div>
      )}
    </Dropdown>
  )
}
