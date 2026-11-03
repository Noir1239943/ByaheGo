import { StatusBadge } from '@/components/common/StatusBadge'
import { INCIDENT_LABELS } from '@/lib/constants'
import { formatDateTime, peso } from '@/lib/format'
import type { BookingIncident } from '@/types'

export function IncidentsList({ incidents }: { incidents: BookingIncident[] }) {
  if (!incidents.length) return null
  return (
    <ul className="space-y-3">
      {incidents.map((i) => (
        <li key={i.id} className="rounded-2xl border border-line-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{INCIDENT_LABELS[i.type] ?? i.type} <span className="text-xs font-normal text-ink-500">· reported by {i.reporter_role}</span></p>
            <StatusBadge status={i.status} />
          </div>
          <p className="mt-1 text-sm text-ink-700">{i.description}</p>
          <p className="mt-1 text-xs text-ink-500">
            {formatDateTime(i.created_at)}
            {i.amount_claimed > 0 && ` · Claimed ${peso(i.amount_claimed)}`}
            {i.status === 'resolved' && ` · Approved ${peso(i.amount_approved)}`}
          </p>
          {i.resolution_notes && <p className="mt-2 rounded-lg bg-page p-2.5 text-xs text-ink-700"><b>ByaheGo decision:</b> {i.resolution_notes}</p>}
        </li>
      ))}
    </ul>
  )
}
