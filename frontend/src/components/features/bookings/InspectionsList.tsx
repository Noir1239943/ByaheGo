import { Check, Fuel, Gauge, X } from 'lucide-react'
import { INSPECTION_ITEMS } from '@/lib/constants'
import { formatDateTime } from '@/lib/format'
import type { Inspection } from '@/types'

export function InspectionsList({ inspections }: { inspections: Inspection[] }) {
  if (!inspections.length) return <p className="text-sm text-ink-500">Your host records the vehicle's condition with you at pick-up and return.</p>
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {inspections.map((i) => (
        <div key={i.stage} className="rounded-2xl border border-line-200 p-4">
          <p className="font-semibold">{i.stage === 'pickup' ? 'Pick-up check' : 'Return check'}</p>
          <p className="text-xs text-ink-500">{formatDateTime(i.created_at)}</p>
          <div className="mt-3 flex gap-4 text-sm">
            <span className="flex items-center gap-1.5"><Gauge className="size-4 text-brand" /> {i.odometer.toLocaleString()} km</span>
            <span className="flex items-center gap-1.5"><Fuel className="size-4 text-brand" /> {i.fuel_level}% fuel</span>
          </div>
          <ul className="mt-3 space-y-1 text-xs">
            {INSPECTION_ITEMS.filter((it) => it.key in (i.checklist ?? {})).map((it) => (
              <li key={it.key} className="flex items-center gap-2">
                {i.checklist[it.key] ? <Check className="size-3.5 text-success" strokeWidth={3} /> : <X className="size-3.5 text-danger" strokeWidth={3} />}
                <span className={i.checklist[it.key] ? 'text-ink-700' : 'font-semibold text-danger'}>{it.label}</span>
              </li>
            ))}
          </ul>
          {i.notes && <p className="mt-3 rounded-lg bg-page p-2.5 text-xs text-ink-700">“{i.notes}”</p>}
        </div>
      ))}
    </div>
  )
}
