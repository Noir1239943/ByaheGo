import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { AlertCircle, CalendarDays, Info, MapPin, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { PriceBreakdown } from '@/components/common/PriceBreakdown'
import { Alert, Button, DateRangePicker, DateTrigger, Segmented, Skeleton, type DateTab } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { useDebounce } from '@/hooks/useDebounce'
import { getErrorMessage } from '@/lib/api'
import { cn } from '@/lib/cn'
import { defaultTrip, formatDateTime, formatRange, localToIso, peso } from '@/lib/format'
import { vehicleService } from '@/services/vehicles'
import type { ProtectionKey, RentalType, VehicleDetail } from '@/types'

export function BookingWidget({ vehicle: v }: { vehicle: VehicleDetail }) {
  const [params] = useSearchParams()
  const d = defaultTrip()
  const [pickup, setPickup] = useState(params.get('pickup') ?? d.pickup)
  const [ret, setRet] = useState(params.get('return') ?? d.ret)
  const [type, setType] = useState<RentalType>(params.get('type') === 'driver' && v.with_driver_available ? 'driver' : 'self')
  const [plan, setPlan] = useState<ProtectionKey>('standard')
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const pickupField = useRef<HTMLLabelElement>(null)
  const returnField = useRef<HTMLLabelElement>(null)
  const [dates, setDates] = useState<DateTab | null>(null)

  const body = useDebounce({ pickup, ret, type, plan }, 300)
  const valid = !!body.pickup && !!body.ret && new Date(body.ret) > new Date(body.pickup)
  const quote = useQuery({
    queryKey: ['quote', v.id, body],
    queryFn: () => vehicleService.quote(v.id, { pickup_at: localToIso(body.pickup), return_at: localToIso(body.ret), rental_type: body.type, protection_plan: body.plan }),
    enabled: valid,
    retry: false,
  })

  useEffect(() => {
    if (new Date(ret) <= new Date(pickup)) {
      const r = new Date(pickup)
      r.setDate(r.getDate() + 1)
      setRet(new Date(r.getTime() - r.getTimezoneOffset() * 60000).toISOString().slice(0, 16))
    }
  }, [pickup, ret])

  const q = quote.data
  const needsVerification = type === 'self' && user && user.verification_status !== 'verified'
  const ownVehicle = user && user.id === v.host.id
  const checkoutUrl = `/checkout/${v.id}?${new URLSearchParams({ pickup, return: ret, type, plan }).toString()}`

  const reserve = () => {
    if (new Date(pickup) < new Date()) return toast.error('That pick-up time has passed. Choose a later one.')
    if (!user) return navigate('/login', { state: { from: checkoutUrl } })
    if (needsVerification) return navigate('/verify', { state: { from: location.pathname + location.search } })
    navigate(checkoutUrl)
  }

  return (
    <div id="book" className="rounded-2xl border border-line-200 bg-white p-5 shadow-pop">
      <p>
        <span className="text-3xl font-extrabold tracking-tight">{peso(v.daily_rate)}</span>
        <span className="text-sm text-ink-500"> /day</span>
      </p>
      {v.weekly_rate && <p className="mt-0.5 text-xs font-semibold text-success">{peso(v.weekly_rate)}/week for 7+ day trips</p>}

      <div className="mt-4 overflow-hidden rounded-xl border border-line-200">
        <div className="grid divide-y divide-line-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-1 lg:divide-x-0 lg:divide-y xl:grid-cols-2 xl:divide-x xl:divide-y-0">
          <label ref={pickupField} className={cn('block cursor-pointer p-3 transition hover:bg-page focus-within:bg-page', dates === 'pickup' && 'bg-page')}>
            <span className="flex items-center gap-1 text-[11px] font-semibold tracking-wide text-ink-500 uppercase"><CalendarDays className="size-3" /> Pick-up</span>
            <DateTrigger tab="pickup" value={pickup} open={dates} onOpenChange={setDates} compact className="mt-0.5 w-full text-[13px] font-semibold outline-none" />
          </label>
          <label ref={returnField} className={cn('block cursor-pointer p-3 transition hover:bg-page focus-within:bg-page', dates === 'return' && 'bg-page')}>
            <span className="flex items-center gap-1 text-[11px] font-semibold tracking-wide text-ink-500 uppercase"><CalendarDays className="size-3" /> Return</span>
            <DateTrigger tab="return" value={ret} open={dates} onOpenChange={setDates} compact className="mt-0.5 w-full text-[13px] font-semibold outline-none" />
          </label>
        </div>
        <DateRangePicker
          open={dates}
          onOpenChange={setDates}
          pickup={pickup}
          ret={ret}
          onChange={(next) => {
            setPickup(next.pickup)
            setRet(next.ret)
          }}
          booked={v.booked_ranges}
          anchors={[pickupField, returnField]}
        />
        <div className="border-t border-line-200 p-3">
          <span className="flex items-center gap-1 text-[11px] font-semibold tracking-wide text-ink-500 uppercase"><MapPin className="size-3" /> Pick-up location</span>
          <p className="mt-0.5 text-sm font-semibold">{v.pickup.label}</p>
        </div>
      </div>

      {v.with_driver_available && (
        <Segmented
          className="mt-3"
          value={type}
          onChange={setType}
          options={[
            { value: 'self', label: 'Self-drive', sub: 'Included' },
            { value: 'driver', label: 'With driver', sub: `+${peso(v.driver_fee_per_day)}/day` },
          ]}
        />
      )}

      <div className="mt-4">
        <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><ShieldCheck className="size-4 text-brand" /> Protection plan</p>
        <div className="space-y-2">
          {v.policies.protection_plans.map((p) => (
            <label key={p.key} className={cn('flex cursor-pointer gap-3 rounded-xl border p-3 transition', plan === p.key ? 'border-brand bg-brand-tint' : 'border-line-200 hover:border-ink-400')}>
              <input type="radio" name="plan" className="mt-1 accent-brand" checked={plan === p.key} onChange={() => setPlan(p.key)} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                  {p.name}
                  <span className={p.price_per_day ? 'text-ink-900' : 'text-success'}>{p.price_per_day ? `+${peso(p.price_per_day)}/day` : 'Included'}</span>
                </span>
                <span className="mt-0.5 block text-xs text-ink-500">You pay up to {peso(p.liability_cap)} if the car is accidentally damaged.</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {!valid ? (
          <Alert tone="warning">{!pickup || !ret ? 'Choose your pick-up and return dates.' : 'Your return time needs to be after pick-up.'}</Alert>
        ) : quote.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4" />
            <Skeleton className="h-4" />
            <Skeleton className="h-6" />
          </div>
        ) : quote.error ? (
          <Alert tone="danger">{getErrorMessage(quote.error)}</Alert>
        ) : q ? (
          <>
            {!q.available && (
              <Alert tone="danger" className="mb-3" icon={<AlertCircle />} title="Not available for these dates">
                Someone already booked part of this time. Try other dates.
              </Alert>
            )}
            <PriceBreakdown q={q} />
          </>
        ) : null}
      </div>

      {ownVehicle ? (
        <Alert tone="info" className="mt-4">This is your vehicle. Manage it from your host dashboard.</Alert>
      ) : (
        <>
          <Button fullWidth size="lg" className="mt-4" disabled={!valid || !q || !q.available} onClick={reserve}>
            {needsVerification ? 'Verify your license to book' : 'Reserve'}
          </Button>
          <p className="mt-2 text-center text-xs text-ink-500">
            {needsVerification ? 'One-time check – it takes about 3 minutes.' : 'You won\'t be charged yet. Review everything on the next step.'}
          </p>
        </>
      )}
      {q && (
        new Date(q.free_cancellation_until) > new Date() ? (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-success-soft p-3 text-xs text-ink-700">
            <Info className="mt-0.5 size-3.5 shrink-0 text-success" /> Free cancellation until {formatDateTime(q.free_cancellation_until)} (a day before pick-up).
          </p>
        ) : (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-accent-soft p-3 text-xs text-ink-700">
            <Info className="mt-0.5 size-3.5 shrink-0 text-warning" /> Pick-up is less than a day away, so this trip can't be cancelled for free once booked.
          </p>
        )
      )}
      {v.booked_ranges.length > 0 && (
        <div className="mt-3 text-xs text-ink-500">
          <p className="font-semibold text-ink-700">Already booked:</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {v.booked_ranges.slice(0, 4).map((r) => (
              <li key={r.from} className="rounded-full bg-line-100 px-2 py-0.5">{formatRange(r.from, r.to)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
