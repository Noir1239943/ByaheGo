import { peso } from '@/lib/format'

export const AGREEMENT_VERSION = '2026.2'

const SECTIONS = (deposit?: number) => [
  {
    id: 'booking',
    title: '1. Booking and payment',
    body: [
      'Your booking is confirmed once payment succeeds. You pay the trip total plus a refundable security deposit.',
      'Payments go through our payment partner (GCash, Maya, cards, Google Pay, Apple Pay). You get an official receipt (OR) and invoice for every payment in Payments & billing.',
    ],
  },
  {
    id: 'cancellation',
    title: '2. Cancellations and refunds',
    body: [
      'You can cancel for free up to 24 hours (one day) before your pick-up time. You get a full refund of the trip total and the deposit to your original payment method, minus a cancellation fee only if ByaheGo has set one (it is shown at checkout and in your agreement; by default there is none).',
      'Less than 24 hours before pick-up, trips can no longer be cancelled in the app. Contact support if something urgent comes up – we review these case by case.',
      'If a host or ByaheGo cancels your trip, you always get a full refund, at any time.',
      'Refunds usually show up within 3–5 banking days, depending on your bank or e-wallet.',
    ],
  },
  {
    id: 'inspection',
    title: '3. Pick-up and return inspections',
    body: [
      'At pick-up and return, you and the host walk around the vehicle together. The host records the odometer, fuel level and a checklist (body, interior, tires, lights, engine bay, tools and documents) with photos.',
      'These records protect you: you are never charged for damage that was already there at pick-up.',
    ],
  },
  {
    id: 'late',
    title: '4. Late returns (excess hours)',
    body: [
      'Every listing sets its own grace period after the scheduled return time (shown on the listing and written into your agreement).',
      'After that, the vehicle\'s hourly late fee applies for every hour or part of an hour, capped at 1.5× the daily rate for each day late. Late fees are deducted from your deposit; anything above the deposit is billed to you.',
      'If you need more time, contact your host before your return time.',
    ],
  },
  {
    id: 'damage',
    title: '5. Damage and liability',
    body: [
      `A refundable security deposit${deposit ? ` (${peso(deposit)} for this vehicle)` : ''} is held during your trip and returned within 3 days of the return inspection.`,
      'If the vehicle is accidentally damaged during your trip, you are liable for repair costs up to the limit of your protection plan: Standard ₱20,000, Plus ₱8,000, Premium ₱2,500.',
      'The host files a damage report with photos and an estimate. ByaheGo reviews every claim and can approve, reduce or dismiss it. Approved amounts are taken from your deposit first; any remaining balance is billed to you.',
    ],
  },
  {
    id: 'theft',
    title: '6. Theft, missing parts and tampering',
    body: [
      'Protection plans do not cover theft, missing parts or tampering. If the vehicle is stolen while in your care, or parts are removed or swapped (for example the battery, tires, engine parts or accessories), you are fully liable for the loss.',
      'Not returning the vehicle is treated as theft: your account is suspended immediately, your deposit is forfeited, and the case is reported to the Philippine National Police.',
      'If the vehicle is stolen from you, report it to the PNP and to ByaheGo right away and send us the police blotter.',
    ],
  },
  {
    id: 'violations',
    title: '7. Traffic violations and tolls',
    body: ['You are responsible for traffic tickets, towing, parking fees and tolls during your trip. Fines that reach the host after your trip are billed to you with proof.'],
  },
  {
    id: 'care',
    title: '8. Fuel, cleanliness and care',
    body: [
      'Return the vehicle with the same fuel level. Missing fuel is charged at pump price plus a ₱200 refuelling fee.',
      'No smoking or vaping. Excessive dirt, pet hair (unless the listing is pet-friendly) or smoke smell may lead to a cleaning fee of up to ₱1,500.',
    ],
  },
  {
    id: 'use',
    title: '9. Who can drive and how',
    body: [
      'Only the verified driver on the booking may drive (unless you booked with a driver). Drivers must be at least 21 with a valid license.',
      'No driving under the influence, racing, off-road use (unless allowed by the host), carrying goods for hire, or taking the vehicle off Cebu island without the host\'s written permission.',
    ],
  },
  {
    id: 'disputes',
    title: '10. Help and disputes',
    body: ['If you disagree with a charge, reply within 7 days from Help center. Our team reviews inspection records, photos and messages from both sides and makes a final decision.'],
  },
]

export function RentalAgreement({ deposit }: { deposit?: number }) {
  return (
    <div className="space-y-6 text-sm leading-relaxed text-ink-700">
      {SECTIONS(deposit).map((s) => (
        <div key={s.id} id={s.id} className="scroll-mt-24">
          <h3 className="mb-2 text-base font-bold text-ink-900">{s.title}</h3>
          <ul className="list-disc space-y-1.5 pl-5">
            {s.body.map((b) => <li key={b}>{b}</li>)}
          </ul>
        </div>
      ))}
      <p className="text-xs text-ink-400">Agreement version {AGREEMENT_VERSION}. When you book, we record the version, date and time you accepted it.</p>
    </div>
  )
}
