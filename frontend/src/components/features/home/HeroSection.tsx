import { useQuery } from '@tanstack/react-query'
import { BadgeCheck, Check, Star, Zap } from 'lucide-react'
import { SearchForm } from '@/components/common/SearchBar'
import { VehicleArt } from '@/components/common/VehicleArt'
import { STALE } from '@/lib/constants'
import { peso } from '@/lib/format'
import { vehicleService } from '@/services/vehicles'

export function HeroSection() {
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: vehicleService.stats, staleTime: STALE.static })
  return (
    <section className="relative overflow-hidden bg-hero text-white">
      <div className="pointer-events-none absolute -right-20 bottom-0 size-[420px] rounded-full bg-accent/25 blur-3xl" />
      <div className="pointer-events-none absolute top-10 right-[18%] size-72 rounded-full bg-white/[0.04]" />
      <div className="container-page relative grid items-center gap-10 py-12 lg:grid-cols-[1.15fr_1fr] lg:py-16">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90">
            <BadgeCheck className="size-4 text-accent" /> Verified hosts in {stats?.cities ?? 6}+ cities across Cebu
          </span>
          <h1 className="mt-5 text-4xl leading-[1.08] font-extrabold tracking-tight sm:text-5xl lg:text-[56px]">
            Your Ride, Your Way – Explore Cebu with ease
          </h1>
          <p className="mt-4 max-w-xl text-base text-white/75 sm:text-lg">
            Cars, SUVs, vans and motorcycles from trusted local hosts. Compare prices, book in minutes, and pick up near you.
          </p>
          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/85">
            {['Free cancellation up to a day before', 'Damage policy included', 'Report problems in the app'].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check className="size-4 text-accent" strokeWidth={3} /> {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative hidden h-72 lg:block">
          <div className="absolute inset-x-6 bottom-6 h-56 rounded-full bg-white/[0.06]" />
          <VehicleArt type="suv" color="#0D7C6B" className="absolute right-0 bottom-4 w-[92%] drop-shadow-2xl" />
          <div className="absolute top-2 left-4 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-ink-900 shadow-pop">
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand-soft text-brand"><Zap className="size-4.5" /></span>
            <span>
              <span className="block text-sm font-bold">From {peso(stats?.min_rate ?? 550)}/day</span>
              <span className="block text-xs text-ink-500">Instant booking available</span>
            </span>
          </div>
          <div className="absolute top-0 right-2 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-ink-900 shadow-pop">
            <span className="flex size-9 items-center justify-center rounded-xl bg-accent-soft"><Star className="size-4.5 fill-accent text-accent" /></span>
            <span>
              <span className="block text-sm font-bold">{(stats?.avg_rating || 4.8).toFixed(1)} / 5</span>
              <span className="block text-xs text-ink-500">Average vehicle rating</span>
            </span>
          </div>
        </div>
        <div className="lg:col-span-2">
          <SearchForm />
        </div>
      </div>
    </section>
  )
}
