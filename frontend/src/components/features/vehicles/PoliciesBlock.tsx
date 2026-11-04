import { Ban, Clock, Fuel, ShieldAlert, ShieldCheck, Wallet } from 'lucide-react'
import { Link } from 'react-router'
import { peso } from '@/lib/format'
import type { VehicleDetail } from '@/types'

/** Plain-language rules so renters know exactly what happens before they book. */
export function PoliciesBlock({ v }: { v: VehicleDetail }) {
  const p = v.policies
  const items = [
    { icon: Ban, title: 'Free cancellation until a day before', text: `Cancel up to ${p.cancellation_cutoff_hours} hours before pick-up and get a full refund – rental and deposit – to your original payment method.` },
    { icon: Clock, title: 'Late returns', text: `Late return: ${peso(v.late_terms.per_hour)} per hour after a ${v.late_terms.grace_minutes}-minute grace period. ${v.late_terms.full_day_after_hours}+ hours late counts as one extra full day (${peso(v.late_terms.daily_rate)}). It is counted when you submit the return photos and taken from your deposit. Ask the host for more time before the return time to avoid it.` },
    { icon: Wallet, title: `${peso(v.security_deposit)} refundable deposit`, text: `Held when you book and returned within ${p.deposit_release_days} days after the vehicle is checked at return.` },
    { icon: ShieldCheck, title: 'Accidental damage', text: 'Your protection plan limits what you pay if the vehicle is damaged by accident. Pick-up and return photos are recorded so nobody is blamed for old scratches.' },
    { icon: ShieldAlert, title: 'Theft, missing parts and negligence', text: 'Not covered by protection plans. If the vehicle or its parts (battery, tires, accessories) go missing during your trip, you\'re fully liable, and the case is reported to the PNP.' },
    { icon: Fuel, title: 'Fuel', text: 'Return the vehicle with the same fuel level as pick-up. Missing fuel is charged at pump price plus ₱200.' },
  ]
  return (
    <div>
      <h2 className="text-xl font-bold">Rules & policies</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {items.map((i) => (
          <div key={i.title} className="flex gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand"><i.icon className="size-4.5" /></span>
            <div>
              <p className="text-sm font-semibold">{i.title}</p>
              <p className="mt-0.5 text-sm text-ink-500">{i.text}</p>
            </div>
          </div>
        ))}
      </div>
      <Link to="/terms" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-brand hover:underline">Read the full rental agreement →</Link>
    </div>
  )
}
