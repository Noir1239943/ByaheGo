import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ClipboardList, Search } from 'lucide-react'
import { ErrorState, ListSkeleton } from '@/components/common/States'
import { Badge, Card, EmptyState, Input, Pagination, Select, Table } from '@/components/ui'
import { useDebounce } from '@/hooks/useDebounce'
import { formatDateTime } from '@/lib/format'
import { adminService } from '@/services/admin'
import type { AuditLogEntry } from '@/types'

const GROUPS = [
  { value: '', label: 'All actions' },
  { value: 'user.', label: 'Accounts (suspend, revoke, reinstate)' },
  { value: 'verification.', label: 'ID verifications' },
  { value: 'host_application.', label: 'Host applications' },
  { value: 'listing.', label: 'Listings' },
  { value: 'booking.', label: 'Bookings and refunds' },
  { value: 'payout.', label: 'Payouts' },
  { value: 'dispute.', label: 'Disputes' },
  { value: 'settings.', label: 'Settings' },
]

const LABEL: Record<string, string> = {
  'user.suspend': 'Suspended account', 'user.revoke': 'Revoked account', 'user.reinstate': 'Reinstated account',
  'verification.approve': 'Approved ID', 'verification.reject': 'Rejected ID', 'verification.override': 'Overrode ID decision', 'verification.revoke': 'Revoked ID verification',
  'host_application.approve': 'Approved host', 'host_application.reject': 'Declined host',
  'listing.approve': 'Approved listing', 'listing.reject': 'Sent listing back', 'listing.pause': 'Paused listing',
  'booking.cancel': 'Cancelled booking', 'booking.refund': 'Issued refund', 'payout.mark_paid': 'Marked payout paid', 'dispute.resolve': 'Resolved dispute', 'settings.update': 'Changed settings',
}

/** Every admin action: who, what, when and the reason they gave. */
export function AdminAuditLogSection() {
  const [q, setQ] = useState('')
  const [action, setAction] = useState('')
  const [page, setPage] = useState(1)
  const dq = useDebounce(q)
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'audit-log', dq, action, page], queryFn: () => adminService.auditLog({ q: dq || undefined, action: action || undefined, page }), placeholderData: keepPreviousData })
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input placeholder="Search admin, person or reason" leftIcon={<Search />} value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} wrapperClassName="flex-1 min-w-56" aria-label="Search the audit log" />
        <Select aria-label="Action" value={action} onChange={(e) => { setAction(e.target.value); setPage(1) }} options={GROUPS} wrapperClassName="w-72" />
      </div>
      <Card>
        {isLoading ? <div className="p-5"><ListSkeleton /></div> : error ? <ErrorState error={error} onRetry={() => void refetch()} /> : (
          <>
            <Table<AuditLogEntry>
              rows={data!.data}
              rowKey={(l) => l.id}
              empty={<EmptyState icon={<ClipboardList />} title="Nothing logged yet" description="Admin actions show up here." />}
              columns={[
                { key: 'when', header: 'When', cell: (l) => <span className="whitespace-nowrap text-ink-500">{formatDateTime(l.created_at)}</span> },
                { key: 'who', header: 'Admin', cell: (l) => <span className="font-medium">{l.actor ?? 'System'}</span> },
                { key: 'what', header: 'Action', cell: (l) => <Badge tone={l.action.includes('revoke') || l.action.includes('suspend') || l.action.includes('reject') ? 'danger' : 'neutral'}>{LABEL[l.action] ?? l.action}</Badge> },
                { key: 'target', header: 'On', cell: (l) => <span className="text-ink-700">{l.target_label ?? '—'}</span> },
                { key: 'reason', header: 'Reason', cell: (l) => <span className="block max-w-sm text-xs text-ink-700">{l.reason ?? '—'}</span> },
              ]}
            />
            <div className="border-t border-line-100 p-4"><Pagination meta={data!.meta} onChange={setPage} label="entries" /></div>
          </>
        )}
      </Card>
    </section>
  )
}
