import { Headset, MapPin, ShieldCheck, Wallet } from 'lucide-react'
import { SectionHeading } from '@/components/common/SectionHeading'

const ITEMS = [
  { icon: ShieldCheck, title: 'Verified hosts and vehicles', text: 'Every host is ID-checked and every vehicle is reviewed by our team before it goes live.' },
  { icon: Wallet, title: 'Clear, all-in pricing', text: 'See the full price before you book. Pay with GCash, Maya, cards, Google Pay or Apple Pay.' },
  { icon: Headset, title: '24/7 roadside support', text: 'Flat tire at midnight in Moalboal? Our team picks up, day or night.' },
  { icon: MapPin, title: 'Pick up near you', text: 'Meet your host at a ByaheGo hub or nearby spot – sort by distance to find the closest car.' },
]

export function PeaceOfMindSection() {
  return (
    <section className="container-page py-14">
      <SectionHeading eyebrow="Why rent with us" title="Peace of mind on every trip" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map((i) => (
          <div key={i.title} className="rounded-2xl border border-line-200 bg-white p-5 shadow-card">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <i.icon className="size-5" />
            </span>
            <h3 className="mt-4 font-bold">{i.title}</h3>
            <p className="mt-1.5 text-sm text-ink-500">{i.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
