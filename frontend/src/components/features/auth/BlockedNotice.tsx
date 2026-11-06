import { Ban } from 'lucide-react'
import { Alert } from '@/components/ui'
import { formatDate } from '@/lib/format'
import type { BlockInfo } from '@/types'

/** Shown instead of a generic error when a suspended or revoked person tries to sign in. */
export function BlockedNotice({ block }: { block: BlockInfo }) {
  const revoked = block.type === 'revoked'
  return (
    <Alert tone="danger" className="mt-5" icon={<Ban />} title={revoked ? 'Your account has been closed' : 'Your account is on hold'}>
      {block.reason && <p><b>Reason:</b> {block.reason}</p>}
      {block.until && <p className="mt-1">This hold ends on <b>{formatDate(block.until)}</b>. You can log in again after that.</p>}
      <p className="mt-2 text-xs">
        Think this is a mistake? Email <a className="font-semibold underline" href={`mailto:${block.appeal_email}?subject=Account%20appeal`}>{block.appeal_email}</a> with your username and a short explanation, or use the <a className="font-semibold underline" href={block.appeal_url}>contact form</a>.
      </p>
    </Alert>
  )
}
