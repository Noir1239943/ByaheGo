import { Badge, type BadgeTone } from '@/components/ui'
import type { Payment } from '@/types'

/**
 * A payment or refund status in plain words. A refund that is "pending" is on its way back to the renter.
 * Renters never see "Refund failed": a stuck refund is for the admin to retry, so to the renter it is still being processed.
 */
export function PaymentStatusBadge({ p, className, admin = false }: { p: Pick<Payment, 'type' | 'status'>; className?: string; admin?: boolean }) {
  const refund = p.type === 'refund'
  if (refund && p.status === 'failed' && !admin) p = { ...p, status: 'pending' }
  const [tone, text]: [BadgeTone, string] =
    p.status === 'succeeded' ? ['success', refund ? 'Refunded' : 'Paid']
    : p.status === 'pending' ? ['warning', refund ? 'Refund processing' : 'Awaiting payment']
    : p.status === 'failed' ? ['danger', refund ? 'Refund failed' : 'Not paid']
    : p.status === 'expired' ? ['neutral', 'Expired']
    : ['neutral', p.status]
  return <Badge tone={tone} dot className={className}>{text}</Badge>
}
