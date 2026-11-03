import { useState, type FormEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, Calendar, CreditCard, KeyRound, Lock, MapPin, ShieldCheck, Smartphone, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { PriceBreakdown } from '@/components/common/PriceBreakdown'
import { RatingInline } from '@/components/common/RatingStars'
import { ErrorState, PageLoader } from '@/components/common/States'
import { VehicleImage } from '@/components/common/VehicleImage'
import { InfoRow } from '@/components/common/InfoRow'
import { Alert, Badge, Button, Card, Checkbox, Input } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { getErrorMessage, getFieldErrors } from '@/lib/api'
import { cn } from '@/lib/cn'
import { PAYMENT_METHODS } from '@/lib/constants'
import { formatDateTime, localToIso, peso } from '@/lib/format'
import { bookingService } from '@/services/bookings'
import { namesMatch } from '@/lib/agreement'
import { agreementService } from '@/services/agreement'
import { vehicleService } from '@/services/vehicles'
import { SignAgreement, type Signing } from './SignAgreement'
import type { PaymentMethod, ProtectionKey, RentalType } from '@/types'

const METHOD_ICON = { gcash: Wallet, maya: Wallet, card: CreditCard, google_pay: Smartphone, apple_pay: Smartphone }

export function PaymentFields({ method, values, setValue, errors }: { method: PaymentMethod; values: Record<string, string>; setValue: (k: string, v: string) => void; errors: Record<string, string> }) {
  if (method === 'gcash' || method === 'maya') {
    return (
      <Input
        label={`${method === 'gcash' ? 'GCash' : 'Maya'} mobile number`}
        type="tel"
        inputMode="numeric"
        placeholder="0917 123 4567"
        value={values.wallet_number ?? ''}
        onChange={(e) => setValue('wallet_number', e.target.value)}
        error={errors.wallet_number}
        hint="You'll approve the payment in your app."
      />
    )
  }
  if (method === 'card') {
    const fmtCard = (v: string) => v.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ')
    const fmtExp = (v: string) => {
      const d = v.replace(/\D/g, '').slice(0, 4)
      return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
    }
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Name on card" autoComplete="cc-name" value={values.card_name ?? ''} onChange={(e) => setValue('card_name', e.target.value)} wrapperClassName="sm:col-span-2" />
        <Input label="Card number" autoComplete="cc-number" inputMode="numeric" placeholder="1234 5678 9012 3456" value={values.card_number ?? ''} onChange={(e) => setValue('card_number', fmtCard(e.target.value))} error={errors.card_number} wrapperClassName="sm:col-span-2" leftIcon={<CreditCard />} />
        <Input label="Expiry" autoComplete="cc-exp" inputMode="numeric" placeholder="MM/YY" value={values.card_expiry ?? ''} onChange={(e) => setValue('card_expiry', fmtExp(e.target.value))} error={errors.card_expiry} />
        <Input label="Security code" autoComplete="cc-csc" inputMode="numeric" placeholder="CVC" maxLength={4} value={values.card_cvc ?? ''} onChange={(e) => setValue('card_cvc', e.target.value.replace(/\D/g, ''))} error={errors.card_cvc} />
      </div>
    )
  }
  return <p className="rounded-xl bg-page p-3 text-sm text-ink-500">You'll confirm with {method === 'google_pay' ? 'Google Pay' : 'Face ID or Touch ID in Apple Pay'} when you tap the button below.</p>
}

export function PaymentMethodPicker({ value, onChange }: { value: PaymentMethod; onChange: (m: PaymentMethod) => void }) {
  return (
    <div className="space-y-2.5">
      {PAYMENT_METHODS.map((m) => {
        const Icon = METHOD_ICON[m.value]
        return (
          <label key={m.value} className={cn('flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition', value === m.value ? 'border-brand bg-brand-tint ring-2 ring-brand/15' : 'border-line-200 hover:border-ink-400')}>
            <input type="radio" name="payment_method" className="accent-brand" checked={value === m.value} onChange={() => onChange(m.value)} />
            <span className="flex size-9 items-center justify-center rounded-lg bg-white text-brand shadow-sm"><Icon className="size-4.5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{m.label}</span>
              <span className="block text-xs text-ink-500">{m.hint}</span>
            </span>
            {m.badge && <Badge tone="accent" className="hidden sm:inline-flex">{m.badge}</Badge>}
          </label>
        )
      })}
    </div>
  )
}

export function CheckoutSection() {
  const { vehicleId = '' } = useParams()
  const [params] = useSearchParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const pickup = params.get('pickup') ?? ''
  const ret = params.get('return') ?? ''
  const type = (params.get('type') === 'driver' ? 'driver' : 'self') as RentalType
  const plan = (params.get('plan') ?? 'standard') as ProtectionKey

  const vehicle = useQuery({ queryKey: ['vehicle', vehicleId], queryFn: () => vehicleService.get(vehicleId) })
  const quote = useQuery({
    queryKey: ['quote', vehicleId, pickup, ret, type, plan],
    queryFn: () => vehicleService.quote(vehicleId, { pickup_at: localToIso(pickup), return_at: localToIso(ret), rental_type: type, protection_plan: plan }),
    enabled: !!pickup && !!ret,
    retry: false,
  })

  const [driver, setDriver] = useState({ driver_name: user?.name ?? '', driver_phone: user?.phone ?? '', driver_email: user?.email ?? '' })
  const [method, setMethod] = useState<PaymentMethod>('gcash')
  const [pay, setPay] = useState<Record<string, string>>({ wallet_number: user?.phone ?? '' })
  const [signing, setSigning] = useState<Signing>({ readToEnd: false, agree: false, name: '' })
  const [age, setAge] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const mutation = useMutation({
    mutationFn: async () => {
      // A short pause so the "processing" step feels like a real payment app.
      const [booking] = await Promise.all([
        bookingService.create({
          vehicle_id: Number(vehicleId),
          pickup_at: localToIso(pickup),
          return_at: localToIso(ret),
          rental_type: type,
          protection_plan: plan,
          ...driver,
          payment_method: method,
          ...pay,
          agree_terms: signing.agree,
          agreement_read_to_end: signing.readToEnd,
          agreement_hash: agreement.data?.hash,
          signature_name: signing.name,
          confirm_age: type === 'self' ? age : true,
        }),
        new Promise((r) => setTimeout(r, 1200)),
      ])
      return booking
    },
    onSuccess: (b) => {
      toast.success('Payment received – your trip is booked!')
      navigate(`/booking/${b.reference}/confirmed`, { replace: true })
    },
    onError: (err) => {
      setErrors(getFieldErrors(err))
      toast.error(getErrorMessage(err, 'We couldn\'t complete your payment. Please try again.'))
    },
  })

  if (!pickup || !ret) return <div className="container-page py-10"><Alert tone="warning" title="Pick your dates first" action={<Button to={`/vehicles/${vehicleId}`}>Back to vehicle</Button>}>Choose pick-up and return times on the vehicle page.</Alert></div>
  if (vehicle.isLoading || quote.isLoading) return <PageLoader label="Getting your trip ready…" />
  // The agreement filled in for exactly this trip. Its hash is what the renter signs.
  const needsId = type === 'self' && user?.verification_status !== 'verified'
  const agreement = useQuery({
    queryKey: ['agreement', vehicleId, pickup, ret, type, plan],
    queryFn: () => agreementService.preview(vehicleId, { pickup_at: localToIso(pickup), return_at: localToIso(ret), rental_type: type, protection_plan: plan }),
    enabled: !!pickup && !!ret && !!user && !needsId,
    retry: false,
    staleTime: 60_000,
  })

  if (vehicle.error) return <div className="container-page py-10"><ErrorState error={vehicle.error} /></div>
  const v = vehicle.data!
  const q = quote.data
  const needsVerification = type === 'self' && user?.verification_status !== 'verified'

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!driver.driver_name.trim()) errs.driver_name = 'Please enter the driver\'s full name.'
    if (!driver.driver_phone.trim()) errs.driver_phone = 'Add a mobile number so your host can reach you.'
    if (type === 'self' && !age) errs.confirm_age = 'Please confirm you\'re at least 21 with a valid license.'
    if (!agreement.data) errs.agreement = 'The rental agreement has not loaded yet.'
    else if (!signing.readToEnd) errs.agreement_read_to_end = 'Scroll to the end of the rental agreement before you sign.'
    else if (!signing.agree) errs.agree_terms = 'Please tick "I agree" to continue.'
    else if (!namesMatch(signing.name, agreement.data.signer_name)) errs.signature_name = `Type your full name exactly as on your verified license: ${agreement.data.signer_name}.`
    setErrors(errs)
    if (Object.keys(errs).length) return toast.error(Object.values(errs)[0])
    mutation.mutate()
  }

  const backUrl = `/vehicles/${v.id}?${new URLSearchParams({ pickup, return: ret, type }).toString()}`

  return (
    <section className="container-page py-6 lg:py-10">
      <Link to={backUrl} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"><ArrowLeft className="size-4" /> Back to vehicle</Link>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight">Confirm and pay</h1>

      {needsVerification && (
        <Alert tone="warning" className="mt-5" title="Verify your driver's license first" action={<Button size="sm" to="/verify" variant="dark">Verify now</Button>}>
          {user?.verification_status === 'pending' ? 'We\'re reviewing your documents – you can book as soon as you\'re approved (usually within 24 hours).' : 'It\'s a one-time, 3-minute check that keeps every trip safe.'}
        </Alert>
      )}
      {quote.error && <Alert tone="danger" className="mt-5">{getErrorMessage(quote.error)}</Alert>}
      {q && !q.available && <Alert tone="danger" className="mt-5" title="These dates were just booked">Please go back and choose different dates.</Alert>}

      <form onSubmit={submit} className="mt-6 grid gap-8 lg:grid-cols-[1fr_400px]" noValidate>
        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <h2 className="font-bold">{type === 'driver' ? 'Contact person' : 'Driver details'}</h2>
            <p className="text-sm text-ink-500">{type === 'driver' ? 'Your professional driver will contact this person.' : 'Must match the driver\'s license you\'ll show at pick-up.'}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Input label="Full name" value={driver.driver_name} onChange={(e) => setDriver({ ...driver, driver_name: e.target.value })} error={errors.driver_name} />
              <Input label="Mobile number" type="tel" value={driver.driver_phone} onChange={(e) => setDriver({ ...driver, driver_phone: e.target.value })} error={errors.driver_phone} placeholder="0917 123 4567" />
              <Input label="Email" type="email" value={driver.driver_email} onChange={(e) => setDriver({ ...driver, driver_email: e.target.value })} error={errors.driver_email} hint="We'll send your receipt here." />
              {type === 'self' && <Input label="Driver's license" value={user?.verification_status === 'verified' ? 'Verified ✓' : 'Not verified yet'} disabled />}
            </div>
            {type === 'self' && <Checkbox className="mt-4" checked={age} onChange={(e) => setAge(e.target.checked)} error={errors.confirm_age} label="I'm at least 21 years old and have held a valid driver's license for 2+ years." />}
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-bold">Payment method</h2>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand"><Lock className="size-3.5" /> Encrypted & secure</span>
            </div>
            <div className="mt-4"><PaymentMethodPicker value={method} onChange={(m) => { setMethod(m); setErrors({}) }} /></div>
            <div className="mt-4"><PaymentFields method={method} values={pay} setValue={(k, val) => setPay({ ...pay, [k]: val })} errors={errors} /></div>
            <p className="mt-3 text-xs text-ink-400">Payments run in test mode for this demo – no real money is moved. Test card: 4242 4242 4242 4242, any future date, any CVC.</p>
          </Card>

          <Card className="p-5 sm:p-6">
            <SignAgreement
              agreement={agreement.data}
              loading={agreement.isLoading || (!agreement.data && !agreement.error && !needsId)}
              error={agreement.error ? getErrorMessage(agreement.error) : needsId ? 'Verify your driver\'s license first. The agreement is made out in your verified name.' : null}
              signing={signing}
              onChange={setSigning}
              errors={errors}
            />
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="font-bold">Cancellation policy</h2>
            {q && new Date(q.free_cancellation_until) <= new Date() ? (
              <p className="mt-1 text-sm text-ink-700">Your pick-up is <b>less than a day away</b>, so this booking can't be cancelled for free. Double-check your dates before paying.</p>
            ) : (
              <p className="mt-1 text-sm text-ink-700">
                Free cancellation until <b>{q ? formatDateTime(q.free_cancellation_until) : '24 hours before pick-up'}</b>. You'll get back everything you paid, including the deposit{q && q.cancellation_fee > 0 ? `, minus a ${peso(q.cancellation_fee)} cancellation fee` : ''}. After that, trips can't be cancelled in the app.
              </p>
            )}
          </Card>

          <Button type="submit" size="lg" className="w-full sm:w-auto" icon={<Lock className="size-4" />} loading={mutation.isPending} disabled={!q || !q.available || needsVerification}>
            Confirm and pay {q ? peso(q.due_now) : ''}
          </Button>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="overflow-hidden">
            <div className="p-5">
              <h2 className="font-bold">Trip summary</h2>
              <div className="mt-4 flex gap-3">
                <div className="h-16 w-24 shrink-0 overflow-hidden rounded-xl"><VehicleImage photo={v.photo} type={v.type} color={v.color_hex} alt={v.name} /></div>
                <div className="min-w-0">
                  <p className="truncate font-bold">{v.name}</p>
                  <p className="text-xs text-ink-500">{v.seats} seats · {v.transmission}</p>
                  <RatingInline value={v.rating_avg} count={v.rating_count} />
                </div>
              </div>
              <div className="mt-5 space-y-3.5 border-t border-line-100 pt-5">
                <InfoRow icon={<Calendar />} label="Pick-up" value={formatDateTime(localToIso(pickup))} />
                <InfoRow icon={<Calendar />} label="Return" value={formatDateTime(localToIso(ret))} />
                <InfoRow icon={<MapPin />} label="Location" value={v.pickup.label} />
                <InfoRow icon={<KeyRound />} label="Rental type" value={type === 'driver' ? 'With professional driver' : 'Self-drive'} />
                <InfoRow icon={<ShieldCheck />} label="Protection" value={q?.protection_name ?? '—'} />
              </div>
            </div>
            {q && <div className="border-t border-line-100 bg-page/60 p-5"><PriceBreakdown q={q} /></div>}
          </Card>
          <p className="mt-3 flex items-start gap-2 rounded-2xl bg-brand-tint p-4 text-xs text-ink-700">
            <ShieldCheck className="size-4 shrink-0 text-brand" /> Protection and 24/7 roadside help are included in every trip.
          </p>
        </aside>
      </form>

      {mutation.isPending && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-ink-900/50 p-4">
          <div className="w-full max-w-xs animate-slide-up rounded-3xl bg-white p-6 text-center shadow-pop">
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-soft"><Lock className="size-6 animate-pulse text-brand" /></span>
            <p className="mt-4 font-bold">Processing your payment…</p>
            <p className="mt-1 text-sm text-ink-500">Please don't close this page.</p>
          </div>
        </div>
      )}
    </section>
  )
}
