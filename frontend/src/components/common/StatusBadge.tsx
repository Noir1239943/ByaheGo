import { Badge, type BadgeTone } from '@/components/ui'

const MAP: Record<string, [BadgeTone, string]> = {
  // trips
  upcoming: ['info', 'Upcoming'],
  confirmed: ['info', 'Upcoming'],
  active: ['success', 'On trip'],
  completed: ['neutral', 'Completed'],
  cancelled: ['danger', 'Cancelled'],
  under_review: ['warning', 'Under review'],
  overdue: ['danger', 'Return overdue'],
  // listings
  draft: ['neutral', 'Draft'],
  pending: ['warning', 'In review'],
  live: ['success', 'Live'],
  rejected: ['danger', 'Needs changes'],
  paused: ['neutral', 'Paused'],
  // verification
  unverified: ['neutral', 'Not verified'],
  verified: ['success', 'Verified'],
  approved: ['success', 'Approved'],
  revoked: ['danger', 'Revoked'],
  // people
  suspended: ['danger', 'On hold'],
  // payments
  paid: ['success', 'Paid'],
  refunded: ['info', 'Refunded'],
  partially_refunded: ['info', 'Partly refunded'],
  balance_due: ['danger', 'Balance due'],
  scheduled: ['warning', 'Scheduled'],
  // incidents
  open: ['warning', 'Open'],
  resolved: ['success', 'Resolved'],
  dismissed: ['neutral', 'Dismissed'],
  closed: ['neutral', 'Closed'],
}

export function StatusBadge({ status, className, label }: { status: string; className?: string; label?: string }) {
  const [tone, text] = MAP[status] ?? ['neutral', status]
  return (
    <Badge tone={tone} dot className={className}>
      {label ?? text}
    </Badge>
  )
}
