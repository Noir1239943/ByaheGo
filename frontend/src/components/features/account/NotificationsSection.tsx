import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { Bell, CheckCheck } from 'lucide-react'
import { PageTitle } from '@/components/common/SectionHeading'
import { ListSkeleton } from '@/components/common/States'
import { Button, Card, EmptyState } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/cn'
import { timeAgo } from '@/lib/format'
import { accountService } from '@/services/account'

const dot = { info: 'bg-info', success: 'bg-success', warning: 'bg-accent', danger: 'bg-danger' }

export function NotificationsSection() {
  const qc = useQueryClient()
  const { refresh, unread } = useAuth()
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({ queryKey: ['notifications'], queryFn: accountService.notifications })
  const markAll = async () => {
    await accountService.readAll()
    await refresh()
    void qc.invalidateQueries({ queryKey: ['notifications'] })
  }
  return (
    <section>
      <PageTitle title="Notifications" description="Trip updates, refunds and account news." action={unread > 0 && <Button variant="secondary" size="sm" icon={<CheckCheck className="size-4" />} onClick={() => void markAll()}>Mark all as read</Button>} />
      {isLoading ? <ListSkeleton /> : !data?.length ? (
        <Card><EmptyState icon={<Bell />} title="You're all caught up" description="We'll let you know when something needs your attention." /></Card>
      ) : (
        <Card className="divide-y divide-line-100">
          {data.map((n) => (
            <button
              key={n.id}
              onClick={async () => {
                if (!n.read) { await accountService.readNotification(n.id); void refresh(); void qc.invalidateQueries({ queryKey: ['notifications'] }) }
                if (n.link) navigate(n.link)
              }}
              className={cn('flex w-full gap-3 px-5 py-4 text-left hover:bg-page', !n.read && 'bg-brand-tint/50')}
            >
              <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', n.read ? 'bg-line-200' : dot[n.kind])} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{n.title}</span>
                <span className="block text-sm text-ink-500">{n.body}</span>
              </span>
              <span className="shrink-0 text-xs text-ink-400">{timeAgo(n.created_at)}</span>
            </button>
          ))}
        </Card>
      )}
    </section>
  )
}
