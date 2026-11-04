import { lazy, Suspense } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import {
  ArrowLeft, BadgeCheck, Bluetooth, Camera, Car, Check, Clock, Fuel, Gauge, Heart, Key, MapPin, Share2, ShieldCheck, Snowflake, Usb, Users, Zap,
} from 'lucide-react'
import { RatingInline } from '@/components/common/RatingStars'
import { ErrorState, PageLoader } from '@/components/common/States'
import { Avatar, Badge, Button, Skeleton } from '@/components/ui'
import { useFavorites } from '@/hooks/useFavorites'
import { cn } from '@/lib/cn'
import { typeLabel } from '@/lib/constants'
import { capitalize, formatDate, peso } from '@/lib/format'
import { BookingWidget } from './BookingWidget'
import { PoliciesBlock } from './PoliciesBlock'
import { ReviewsBlock } from './ReviewsBlock'
import { useVehicle } from './useVehicle'
import { VehicleGallery } from './VehicleGallery'

const MapView = lazy(() => import('@/components/common/MapView'))

const FEATURE_ICONS: Record<string, typeof Check> = {
  'Air conditioning': Snowflake, 'Bluetooth audio': Bluetooth, 'USB charging': Usb, 'Backup camera': Camera, 'Dash cam': Camera, 'Keyless entry': Key,
}

export function VehicleDetailSection() {
  const { data: v, isLoading, error, refetch } = useVehicle()
  const { isSaved, toggle } = useFavorites()
  const navigate = useNavigate()

  if (isLoading) return <PageLoader label="Loading vehicle…" />
  if (error || !v) return <div className="container-page py-10"><ErrorState error={error} onRetry={() => void refetch()} title="We couldn't find this vehicle" /></div>

  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: v.name, text: `${v.name} for ${peso(v.daily_rate)}/day on ByaheGo`, url })
      else {
        await navigator.clipboard.writeText(url)
        toast.success('Link copied – share it with your travel buddies!')
      }
    } catch { /* cancelled */ }
  }
  const saved = isSaved(v.id)
  const specs = [
    { icon: Users, label: 'Capacity', value: `${v.seats} seats` },
    { icon: Gauge, label: 'Transmission', value: capitalize(v.transmission) },
    { icon: Fuel, label: 'Fuel type', value: capitalize(v.fuel) },
    { icon: Car, label: 'Model year', value: v.year },
  ]

  return (
    <section className="container-page py-6 pb-28 lg:pb-12">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm">
          <Button variant="secondary" size="sm" icon={<ArrowLeft className="size-4" />} onClick={() => (window.history.length > 2 ? navigate(-1) : navigate('/vehicles'))}>
            Back to results
          </Button>
          <nav className="hidden text-ink-500 sm:block" aria-label="Breadcrumb">
            <Link to={`/vehicles?location=${encodeURIComponent(v.city ?? '')}`} className="hover:text-ink-900">{v.city}</Link>
            {' / '}
            <Link to={`/vehicles?type=${v.type}`} className="hover:text-ink-900">{typeLabel(v.type)}</Link>
            {' / '}
            <span className="text-ink-900">{v.make} {v.model}</span>
          </nav>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<Share2 className="size-4" />} onClick={() => void share()}>Share</Button>
          <Button variant="secondary" size="sm" icon={<Heart className={cn('size-4', saved && 'fill-danger text-danger')} />} onClick={() => toggle(v.id)}>
            {saved ? 'Saved' : 'Save'}
          </Button>
        </div>
      </div>

      <VehicleGallery v={v} />

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-9">
          <div>
            <div className="flex flex-wrap gap-2">
              {v.instant_book && <Badge tone="brand"><Zap className="size-3" /> Instant book</Badge>}
              {v.host.trips >= 20 && <Badge tone="accent"><BadgeCheck className="size-3" /> Top host</Badge>}
              <Badge tone="success"><Check className="size-3" /> Free cancellation</Badge>
              {v.pet_friendly && <Badge tone="neutral">Pet-friendly</Badge>}
            </div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">{v.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-500">
              <RatingInline value={v.rating_avg} count={v.rating_count} className="text-sm" />
              <span className="flex items-center gap-1"><MapPin className="size-4" /> {v.pickup.label}</span>
              <span className="flex items-center gap-1"><ShieldCheck className="size-4 text-brand" /> Hosted by {v.host.name}</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {specs.map((s) => (
                <div key={s.label} className="flex items-center gap-3 rounded-2xl border border-line-200 bg-white p-3">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-brand-tint text-brand"><s.icon className="size-4.5" /></span>
                  <span>
                    <span className="block text-[11px] text-ink-500">{s.label}</span>
                    <span className="block text-sm font-bold">{s.value}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold">About this vehicle</h2>
            <p className="mt-2 leading-relaxed text-ink-700">{v.description || 'A well-maintained vehicle from a verified ByaheGo host.'}</p>
          </div>

          {v.features.length > 0 && (
            <div>
              <h2 className="text-xl font-bold">What's included</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {v.features.map((f) => {
                  const Icon = FEATURE_ICONS[f] ?? Check
                  return (
                    <li key={f} className="flex items-center gap-3 text-sm text-ink-700">
                      <Icon className="size-4.5 text-brand" /> {f}
                    </li>
                  )
                })}
                <li className="flex items-center gap-3 text-sm text-ink-700"><ShieldCheck className="size-4.5 text-brand" /> Standard protection & 24/7 roadside help</li>
              </ul>
            </div>
          )}

          <div>
            <h2 className="text-xl font-bold">Where you'll pick it up</h2>
            <p className="mt-1 text-sm text-ink-500">{v.pickup.type === 'hub' ? 'A staffed ByaheGo hub – easy to find, with parking.' : `Your host meets you in ${v.pickup.area ?? v.pickup.city ?? 'this area'}. The map shows the general area; the exact spot is shared once your booking is confirmed.`}</p>
            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_260px]">
              <div className="h-64 overflow-hidden rounded-2xl border border-line-200">
                <Suspense fallback={<Skeleton className="h-full w-full" />}>
                  <MapView vehicles={[v]} className="h-full w-full" />
                </Suspense>
              </div>
              <div className="space-y-3 rounded-2xl border border-line-200 bg-white p-4 text-sm">
                <p className="font-bold">{v.pickup.hub?.name ?? v.pickup.label}</p>
                {v.pickup.hub && (
                  <>
                    <p className="text-ink-500">{v.pickup.hub.address}, {v.pickup.hub.city}</p>
                    <p className="flex items-center gap-2 text-ink-700"><Clock className="size-4 text-brand" /> Open daily, {v.pickup.hub.hours}</p>
                    {v.pickup.hub.parking_notes && <p className="text-ink-500">{v.pickup.hub.parking_notes}</p>}
                  </>
                )}
                {v.delivery_available && <p className="rounded-xl bg-brand-tint p-3 text-brand-dark">Delivery available for {peso(v.delivery_fee)} – ask your host after booking.</p>}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line-200 bg-white p-5">
            <div className="flex items-center gap-4">
              <Avatar initials={v.host.initials} size="lg" seed={v.host.id} />
              <div>
                <p className="flex items-center gap-1.5 text-lg font-bold">{v.host.name} <BadgeCheck className="size-5 text-brand" /></p>
                <p className="text-sm text-ink-500">Verified host · Joined {formatDate(v.host.joined_at, { year: 'numeric' })} · {v.host.trips} trips</p>
                <p className="text-xs font-semibold text-success">Usually responds within an hour</p>
              </div>
            </div>
            <Button variant="secondary" to="/help#contact">Ask a question</Button>
          </div>

          <PoliciesBlock v={v} />
          <ReviewsBlock v={v} />
        </div>

        <aside id="booking" className="scroll-mt-20 lg:sticky lg:top-24 lg:self-start">
          <BookingWidget vehicle={v} />
          <p className="mt-3 rounded-2xl bg-accent-soft p-4 text-xs text-ink-700">
            A refundable {peso(v.security_deposit)} security deposit is held with your payment and released within {v.policies.deposit_release_days} days of return.
          </p>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-line-200 bg-white px-4 py-3 shadow-pop lg:hidden">
        <p>
          <span className="text-xl font-extrabold">{peso(v.daily_rate)}</span>
          <span className="text-sm text-ink-500">/day</span>
        </p>
        <Button onClick={() => document.getElementById('book')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>Check availability</Button>
      </div>
      {/* Phones: the price and the Book button stay in reach while the page scrolls. */}
      <div className="no-print fixed inset-x-0 bottom-0 z-[800] flex items-center justify-between gap-3 border-t border-line-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-pop lg:hidden">
        <div>
          <p className="text-lg leading-tight font-extrabold">{peso(v.daily_rate)}<span className="text-sm font-medium text-ink-500"> / day</span></p>
          <p className="text-xs text-ink-500">Choose dates to see the total</p>
        </div>
        <Button size="lg" onClick={() => document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Book</Button>
      </div>
    </section>
  )
}
