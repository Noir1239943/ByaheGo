import { Link } from 'react-router'
import { SectionHeading } from '@/components/common/SectionHeading'
import { VehicleArt } from '@/components/common/VehicleArt'
import type { VehicleType } from '@/types'

const TYPES: { type: VehicleType; label: string; sub: string; color: string; query: string }[] = [
  { type: 'sedan', label: 'Cars', sub: 'City trips & airport runs', color: '#FFB224', query: 'sedan,hatchback' },
  { type: 'suv', label: 'SUVs', sub: 'Family trips, up to 7', color: '#0D7C6B', query: 'suv' },
  { type: 'van', label: 'Vans & MPVs', sub: 'Groups of 7–15', color: '#2B2F33', query: 'van,mpv' },
  { type: 'pickup', label: 'Pickups', sub: 'Moving & gear', color: '#D35400', query: 'pickup' },
  { type: 'motorcycle', label: 'Motorcycles', sub: 'Beat the traffic', color: '#C0392B', query: 'motorcycle' },
]

export function VehicleTypesSection() {
  return (
    <section className="container-page pt-14 pb-2">
      <SectionHeading eyebrow="Find the right ride" title="What are you riding today?" />
      <div className="scrollbar-none mt-6 -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-5 lg:px-0">
        {TYPES.map((t) => (
          <Link key={t.type} to={`/vehicles?type=${t.query}`} className="group w-48 shrink-0 snap-start rounded-2xl border border-line-200 bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:border-brand/40 lg:w-auto">
            <div className="flex h-20 items-center justify-center rounded-xl bg-brand-tint">
              <VehicleArt type={t.type} color={t.color} className="w-32 transition group-hover:scale-105" />
            </div>
            <p className="mt-3 font-bold">{t.label}</p>
            <p className="text-xs text-ink-500">{t.sub}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
