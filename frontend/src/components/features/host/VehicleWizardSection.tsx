import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock, Lightbulb, LocateFixed, MapPin, Plus, Store, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { ImageUploader, MultiImageUploader } from '@/components/common/ImageUploader'
import { PageLoader } from '@/components/common/States'
import { VehicleArt } from '@/components/common/VehicleArt'
import { VehicleImage } from '@/components/common/VehicleImage'
import { Alert, Button, Card, Chip, Input, Select, Stepper, Switch, Textarea } from '@/components/ui'
import { useGeolocation } from '@/hooks/useGeolocation'
import { getErrorMessage, getFieldErrors, mediaUrl } from '@/lib/api'
import { cn } from '@/lib/cn'
import { FEATURE_OPTIONS, VEHICLE_TYPES, typeLabel } from '@/lib/constants'
import { capitalize, peso } from '@/lib/format'
import { CITIES } from '@/lib/search'
import { hostService } from '@/services/host'
import { vehicleService } from '@/services/vehicles'
import type { HostVehicle, VehicleType } from '@/types'

const STEPS = ['Details', 'Pricing', 'Location', 'Registration', 'Review']
const COLORS = ['#E9EDF0', '#1F2933', '#A7B1BA', '#C0392B', '#2E5A88', '#0D7C6B', '#FFB224', '#D35400', '#5B1A3A', '#2E7D5B']
const CITY_CENTER: Record<string, [number, number]> = {
  'Cebu City': [10.3157, 123.8854], 'Mandaue City': [10.3236, 123.9223], 'Lapu-Lapu City': [10.3103, 123.9494],
  Cordova: [10.2526, 123.9493], 'Talisay City': [10.2447, 123.8494], Consolacion: [10.3766, 123.9573],
}
const SUGGESTED: Record<VehicleType, [number, number]> = {
  sedan: [1500, 2200], hatchback: [1200, 1600], suv: [2200, 3800], mpv: [2000, 2800], van: [3800, 5500], pickup: [2800, 3600], motorcycle: [450, 900],
}

type Form = {
  type: VehicleType; make: string; model: string; year: string; transmission: 'automatic' | 'manual'; fuel: string; seats: string; color: string; color_hex: string
  description: string; features: string[]; photo_ids: number[]
  daily_rate: string; weekly_rate: string; min_days: string; security_deposit: string; late_fee_per_hour: string
  with_driver_available: boolean; driver_fee_per_day: string; instant_book: boolean; delivery_available: boolean; delivery_fee: string; pet_friendly: boolean
  pickup_type: 'hub' | 'own'; hub_id: number | null; pickup_address: string; city: string; lat: number | null; lng: number | null
  plate_number: string; or_media_id: number | null; cr_media_id: number | null
  ctpl_media_id: number | null; ctpl_expiry: string; grace_minutes: string; fuel_policy: 'same_level' | 'full_to_full'
}

const EMPTY: Form = {
  type: 'sedan', make: '', model: '', year: String(new Date().getFullYear() - 2), transmission: 'automatic', fuel: 'gasoline', seats: '5', color: '', color_hex: '#E9EDF0',
  description: '', features: ['Air conditioning'], photo_ids: [],
  daily_rate: '', weekly_rate: '', min_days: '1', security_deposit: '3000', late_fee_per_hour: '',
  with_driver_available: false, driver_fee_per_day: '1500', instant_book: true, delivery_available: false, delivery_fee: '300', pet_friendly: false,
  pickup_type: 'hub', hub_id: null, pickup_address: '', city: 'Cebu City', lat: null, lng: null,
  plate_number: '', or_media_id: null, cr_media_id: null,
  ctpl_media_id: null, ctpl_expiry: '', grace_minutes: '30', fuel_policy: 'same_level',
}

function fromVehicle(v: HostVehicle): Form {
  const s = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n))
  return {
    type: v.type, make: v.make, model: v.model, year: s(v.year), transmission: v.transmission, fuel: v.fuel, seats: s(v.seats), color: v.color ?? '', color_hex: v.color_hex,
    description: v.description ?? '', features: v.features ?? [], photo_ids: v.photo_ids ?? [],
    daily_rate: v.daily_rate ? s(v.daily_rate) : '', weekly_rate: s(v.weekly_rate), min_days: s(v.min_days), security_deposit: s(v.security_deposit), late_fee_per_hour: s(v.late_fee_per_hour),
    with_driver_available: v.with_driver_available, driver_fee_per_day: s(v.driver_fee_per_day || 1500), instant_book: v.instant_book, delivery_available: v.delivery_available,
    delivery_fee: s(v.delivery_fee || 300), pet_friendly: v.pet_friendly,
    pickup_type: v.pickup_type, hub_id: v.hub_id, pickup_address: v.pickup_address ?? '', city: v.pickup.city ?? 'Cebu City', lat: v.lat, lng: v.lng,
    plate_number: v.plate_number ?? '', or_media_id: v.or_media_id, cr_media_id: v.cr_media_id,
    ctpl_media_id: v.ctpl_media_id, ctpl_expiry: v.ctpl_expiry ?? '', grace_minutes: s(v.grace_minutes ?? 30), fuel_policy: v.fuel_policy ?? 'same_level',
  }
}

function toPayload(f: Form) {
  const n = (s: string) => (s === '' ? null : Number(s))
  return {
    ...f, year: n(f.year), seats: n(f.seats), daily_rate: n(f.daily_rate), weekly_rate: n(f.weekly_rate), min_days: n(f.min_days),
    security_deposit: n(f.security_deposit), late_fee_per_hour: n(f.late_fee_per_hour), driver_fee_per_day: n(f.driver_fee_per_day), delivery_fee: n(f.delivery_fee),
    color: f.color || null, pickup_address: f.pickup_address || null, plate_number: f.plate_number.toUpperCase() || null,
    hub_id: f.pickup_type === 'hub' ? f.hub_id : null,
    grace_minutes: n(f.grace_minutes), ctpl_expiry: f.ctpl_expiry || null,
  }
}

export function VehicleWizardSection() {
  const { id: routeId } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [id, setId] = useState<number | null>(routeId ? Number(routeId) : null)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<Form>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<HostVehicle['status']>('draft')
  const [rejection, setRejection] = useState<string | null>(null)
  const [customFeature, setCustomFeature] = useState('')
  const geo = useGeolocation()

  const existing = useQuery({ queryKey: ['host', 'vehicle', routeId], queryFn: () => hostService.vehicle(routeId!), enabled: !!routeId })
  const hubs = useQuery({ queryKey: ['hubs'], queryFn: vehicleService.hubs, staleTime: 600000 })

  useEffect(() => {
    if (existing.data) {
      setForm(fromVehicle(existing.data))
      setStatus(existing.data.status)
      setRejection(existing.data.rejection_reason)
    }
  }, [existing.data])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))

  if (routeId && existing.isLoading) return <PageLoader />

  const validate = () => {
    const e: Record<string, string> = {}
    if (step === 0) {
      if (!form.make.trim()) e.make = 'Enter the make (e.g. Toyota).'
      if (!form.model.trim()) e.model = 'Enter the model (e.g. Vios 1.3 XLE).'
      if (!form.year || Number(form.year) < 1990) e.year = 'Enter a valid year.'
      if (!form.seats) e.seats = 'How many seats?'
    }
    if (step === 1) {
      if (!form.daily_rate || Number(form.daily_rate) < 300) e.daily_rate = 'Set a daily rate of at least ₱300.'
      if (!form.late_fee_per_hour || Number(form.late_fee_per_hour) < 1) e.late_fee_per_hour = 'Set the fee per excess hour.'
    }
    if (step === 2) {
      if (form.pickup_type === 'hub' && !form.hub_id) e.hub_id = 'Choose a ByaheGo hub.'
      if (form.pickup_type === 'own' && !form.pickup_address.trim()) e.pickup_address = 'Enter a landmark or street where renters meet you.'
    }
    if (step === 3) {
      if (!form.plate_number.trim()) e.plate_number = 'Enter the plate number.'
      if (!form.or_media_id) e.or_media_id = 'Upload a photo of the Official Receipt (OR).'
      if (!form.cr_media_id) e.cr_media_id = 'Upload a photo of the Certificate of Registration (CR).'
      if (!form.ctpl_media_id) e.ctpl_media_id = 'Upload a photo of your CTPL insurance.'
      if (!form.ctpl_expiry) e.ctpl_expiry = 'Enter the CTPL expiry date.'
      else if (form.ctpl_expiry <= new Date().toISOString().slice(0, 10)) e.ctpl_expiry = 'Your CTPL has expired. Renew it first.'
    }
    setErrors(e)
    if (Object.keys(e).length) toast.error(Object.values(e)[0])
    return Object.keys(e).length === 0
  }

  const save = async (): Promise<HostVehicle | null> => {
    setSaving(true)
    try {
      const payload = toPayload(form)
      if (payload.pickup_type === 'own' && (!payload.lat || !payload.lng)) {
        const c = CITY_CENTER[form.city] ?? CITY_CENTER['Cebu City']
        payload.lat = c[0]
        payload.lng = c[1]
      }
      const v = id ? await hostService.updateVehicle(id, payload) : await hostService.createVehicle(payload)
      setId(v.id)
      setStatus(v.status)
      void qc.invalidateQueries({ queryKey: ['host'] })
      return v
    } catch (err) {
      setErrors(getFieldErrors(err))
      toast.error(getErrorMessage(err))
      return null
    } finally {
      setSaving(false)
    }
  }

  const next = async () => {
    if (!validate()) return
    if (await save()) setStep((s) => s + 1)
  }

  const submit = async () => {
    const v = await save()
    if (!v) return
    if (!['draft', 'rejected'].includes(v.status)) {
      toast.success('Changes saved')
      setStep(5)
      return
    }
    try {
      const sent = await hostService.submitVehicle(v.id)
      setStatus(sent.status)
      void qc.invalidateQueries({ queryKey: ['host'] })
      setStep(5)
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const saveAndExit = async () => {
    if (!form.make || !form.model) return navigate('/host/vehicles')
    if (await save()) {
      toast.success('Draft saved')
      navigate('/host/vehicles')
    }
  }

  const hub = hubs.data?.find((h) => h.id === form.hub_id)
  const [lo, hi] = SUGGESTED[form.type]

  if (step === 5) {
    return (
      <section className="mx-auto max-w-xl">
        <Card className="p-8 text-center">
          <CheckCircle2 className="mx-auto size-14 text-success" />
          <h2 className="mt-4 text-2xl font-extrabold">{status === 'pending' ? 'Your listing is in review' : 'Listing updated'}</h2>
          <p className="mt-2 text-ink-500">{status === 'pending' ? 'Our team checks the photos and OR/CR to keep renters safe. Most listings are approved within 24 hours – we\'ll notify you.' : 'Your changes are live.'}</p>
          <ol className="mx-auto mt-6 max-w-xs space-y-3 text-left text-sm">
            <li className="flex items-center gap-3"><span className="flex size-7 items-center justify-center rounded-full bg-brand text-white"><Check className="size-4" /></span> Listing submitted</li>
            <li className="flex items-center gap-3"><span className={cn('flex size-7 items-center justify-center rounded-full', status === 'live' ? 'bg-brand text-white' : 'bg-accent-soft text-warning')}>{status === 'live' ? <Check className="size-4" /> : <Clock className="size-4" />}</span> ByaheGo review</li>
            <li className="flex items-center gap-3 text-ink-500"><span className="flex size-7 items-center justify-center rounded-full border border-line-200">3</span> Live – renters can book</li>
          </ol>
          <div className="mt-6 flex justify-center gap-3"><Button to="/host/vehicles">Go to my vehicles</Button><Button variant="secondary" onClick={() => { setForm(EMPTY); setId(null); setStep(0); navigate('/host/vehicles/new') }}>Add another</Button></div>
        </Card>
      </section>
    )
  }

  const preview = (
    <div className="space-y-4 lg:sticky lg:top-24">
      <p className="text-xs font-bold tracking-wider text-ink-500 uppercase">Renter preview</p>
      <div className="overflow-hidden rounded-2xl border border-line-200 bg-white shadow-card">
        <div className="relative aspect-[4/3]">
          <VehicleImage photo={form.photo_ids[0] ? mediaUrl(form.photo_ids[0]) : null} type={form.type} color={form.color_hex} alt="Preview" />
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold shadow-sm">{form.instant_book ? <><Zap className="size-3 fill-brand text-brand" /> Instant book</> : 'Not listed yet'}</span>
        </div>
        <div className="p-4">
          <p className="font-bold">{form.make || 'Make'} {form.model || 'Model'} <span className="font-medium text-ink-500">{form.year}</span></p>
          <p className="text-xs text-ink-500">{typeLabel(form.type)} · {form.seats || '–'} seats · {capitalize(form.transmission)}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-ink-500"><MapPin className="size-3.5" /> {form.pickup_type === 'hub' ? (hub ? `${hub.name}, ${hub.city}` : 'Pick-up spot not set') : form.pickup_address ? `${form.pickup_address}, ${form.city}` : 'Pick-up spot not set'}</p>
          <p className="mt-3 border-t border-line-100 pt-3"><span className="text-lg font-extrabold">{form.daily_rate ? peso(Number(form.daily_rate)) : '₱—'}</span><span className="text-xs text-ink-500"> /day</span></p>
        </div>
      </div>
      <p className="text-center text-xs text-ink-500">This is how renters will see your listing in search.</p>
      <div className="rounded-2xl bg-brand-tint p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold"><Lightbulb className="size-4 text-brand" /> {['Photo tip', 'Pricing tip', 'Why use a hub', 'Why we need OR/CR', 'Almost done'][step]}</p>
        <p className="mt-1 text-ink-700">{[
          'Clean the car, shoot in open shade, and include the dashboard and trunk.',
          `Similar ${typeLabel(form.type).toLowerCase()}s in Cebu go for ${peso(lo)}–${peso(hi)} a day. Starting a little lower helps you get your first reviews.`,
          'Hubs have parking, CCTV and staff, so handovers are quick and safe for both of you.',
          'We confirm you\'re the registered owner (or authorized) before your vehicle goes live. Your documents are never shown to renters.',
          'Check everything once more. You can still edit the listing after it goes live.',
        ][step]}</p>
      </div>
    </div>
  )

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Stepper steps={STEPS} current={step} compact className="max-w-2xl flex-1" />
        <Button variant="secondary" size="sm" loading={saving} onClick={() => void saveAndExit()}>Save and exit</Button>
      </div>
      {status === 'rejected' && rejection && <Alert tone="danger" className="mb-5" title="Our team asked for changes">{rejection} Update your listing and submit it again.</Alert>}
      {status === 'live' && <Alert tone="info" className="mb-5">This listing is live. Changes you save show to renters right away.</Alert>}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <p className="text-xs font-bold tracking-wider text-brand uppercase">Step {step + 1} of 5</p>
          {step === 0 && (
            <>
              <Card className="p-5 sm:p-6">
                <h2 className="text-lg font-bold">What are you listing?</h2>
                <p className="text-sm text-ink-500">Renters filter by type, so pick the closest match.</p>
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                  {VEHICLE_TYPES.map((t) => (
                    <button key={t.value} type="button" onClick={() => { set('type', t.value); if (t.value === 'motorcycle') set('seats', '2') }} className={cn('flex flex-col items-center gap-1 rounded-2xl border p-2.5 text-xs font-semibold transition', form.type === t.value ? 'border-brand bg-brand-tint text-brand-dark ring-2 ring-brand/15' : 'border-line-200 hover:border-ink-400')}>
                      <VehicleArt type={t.value} color={form.type === t.value ? form.color_hex : '#8B99A6'} className="w-full" />
                      {t.label}
                    </button>
                  ))}
                </div>
              </Card>
              <Card className="p-5 sm:p-6">
                <h2 className="text-lg font-bold">Photos</h2>
                <p className="mb-4 text-sm text-ink-500">Listings with 4+ photos get up to 3× more bookings. You can add them later too.</p>
                <MultiImageUploader value={form.photo_ids} onChange={(ids) => set('photo_ids', ids)} />
              </Card>
              <Card className="p-5 sm:p-6">
                <h2 className="text-lg font-bold">Basic information</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <Input label="Make" value={form.make} onChange={(e) => set('make', e.target.value)} error={errors.make} placeholder="Toyota" />
                  <Input label="Model" value={form.model} onChange={(e) => set('model', e.target.value)} error={errors.model} placeholder="Vios 1.3 XLE" />
                  <Input label="Year" type="number" value={form.year} onChange={(e) => set('year', e.target.value)} error={errors.year} />
                  <Select label="Transmission" value={form.transmission} onChange={(e) => set('transmission', e.target.value as 'manual')} options={[{ value: 'automatic', label: 'Automatic' }, { value: 'manual', label: 'Manual' }]} />
                  <Select label="Fuel type" value={form.fuel} onChange={(e) => set('fuel', e.target.value)} options={['gasoline', 'diesel', 'hybrid', 'electric'].map((f) => ({ value: f, label: capitalize(f) }))} />
                  <Input label="Seats" type="number" min={1} max={20} value={form.seats} onChange={(e) => set('seats', e.target.value)} error={errors.seats} />
                  <Input label="Color" value={form.color} onChange={(e) => set('color', e.target.value)} placeholder="Silver Metallic" optional />
                  <div className="sm:col-span-2">
                    <p className="mb-1.5 text-sm font-medium text-ink-700">Closest color</p>
                    <div className="flex flex-wrap gap-2">
                      {COLORS.map((c) => (
                        <button key={c} type="button" onClick={() => set('color_hex', c)} className={cn('size-8 rounded-full border-2 transition', form.color_hex === c ? 'scale-110 border-ink-900' : 'border-line-200')} style={{ background: c }} aria-label={`Color ${c}`} />
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
              <Card className="p-5 sm:p-6">
                <h2 className="text-lg font-bold">Specifications and features</h2>
                <p className="text-sm text-ink-500">Pick everything your vehicle has. Renters can filter by these.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {[...new Set([...FEATURE_OPTIONS, ...form.features])].map((f) => (
                    <Chip key={f} showCheck active={form.features.includes(f)} onClick={() => set('features', form.features.includes(f) ? form.features.filter((x) => x !== f) : [...form.features, f])}>{f}</Chip>
                  ))}
                </div>
                <div className="mt-3 flex max-w-sm gap-2">
                  <Input placeholder="Add a feature" value={customFeature} onChange={(e) => setCustomFeature(e.target.value)} aria-label="Add a feature" />
                  <Button variant="secondary" icon={<Plus className="size-4" />} onClick={() => { if (customFeature.trim()) { set('features', [...form.features, customFeature.trim()]); setCustomFeature('') } }}>Add</Button>
                </div>
                <Textarea label="Description" rows={4} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="What makes your vehicle great? Is it good for family trips, airport runs, mountain roads?" wrapperClassName="mt-4" optional />
              </Card>
            </>
          )}

          {step === 1 && (
            <>
              <Card className="p-5 sm:p-6">
                <h2 className="text-lg font-bold">Set your price</h2>
                <p className="text-sm text-ink-500">Your daily rate, rates for longer trips, and the extras you accept.</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Input label="Daily rate" type="number" inputMode="numeric" leftIcon={<span className="text-xs font-bold">₱</span>} value={form.daily_rate} onChange={(e) => { set('daily_rate', e.target.value); if (!form.late_fee_per_hour) set('late_fee_per_hour', String(Math.round(Number(e.target.value) * 0.1 / 10) * 10)) }} error={errors.daily_rate} hint={`Similar listings: ${peso(lo)}–${peso(hi)}/day`} />
                  <Input label="Weekly rate (7+ days)" type="number" leftIcon={<span className="text-xs font-bold">₱</span>} value={form.weekly_rate} onChange={(e) => set('weekly_rate', e.target.value)} optional hint={form.daily_rate ? `Renters save vs ${peso(Number(form.daily_rate) * 7)} at the daily rate` : undefined} />
                  <Input label="Minimum trip length (days)" type="number" min={1} value={form.min_days} onChange={(e) => set('min_days', e.target.value)} />
                  <Input label="Security deposit" type="number" leftIcon={<span className="text-xs font-bold">₱</span>} value={form.security_deposit} onChange={(e) => set('security_deposit', e.target.value)} hint="Refundable. Held during the trip." />
                  <Input label="Late return fee per hour" type="number" leftIcon={<span className="text-xs font-bold">₱</span>} value={form.late_fee_per_hour} onChange={(e) => set('late_fee_per_hour', e.target.value)} error={errors.late_fee_per_hour} hint="Charged for each hour after the grace period (excess hours)." />
                  <Input label="Grace period (minutes)" type="number" min={0} max={180} value={form.grace_minutes} onChange={(e) => set('grace_minutes', e.target.value)} hint="Free minutes after the return time before the fee starts." />
                  <Select label="Fuel policy" value={form.fuel_policy} onChange={(e) => set('fuel_policy', e.target.value as Form['fuel_policy'])} options={[{ value: 'same_level', label: 'Return with the same fuel level' }, { value: 'full_to_full', label: 'Full to full (return with a full tank)' }]} />
                </div>
                <Alert tone="brand" className="mt-4" title="How pricing works">Renters see your daily rate plus a small service fee at checkout. You keep 85% of the rental and driver fees, plus any late fees.</Alert>
              </Card>
              <Card className="space-y-5 p-5 sm:p-6">
                <h2 className="text-lg font-bold">Driver and extras</h2>
                {[
                  { k: 'with_driver_available' as const, t: 'Offer a driver', s: 'Renters can add a professional driver for each day.', extra: form.with_driver_available && <Input label="Driver fee per day" type="number" leftIcon={<span className="text-xs font-bold">₱</span>} value={form.driver_fee_per_day} onChange={(e) => set('driver_fee_per_day', e.target.value)} wrapperClassName="mt-3 max-w-xs" /> },
                  { k: 'instant_book' as const, t: 'Instant book', s: 'Renters are confirmed right away – listings with instant book rank higher.' },
                  { k: 'delivery_available' as const, t: 'Offer delivery', s: 'Bring the vehicle to the renter for an extra fee.', extra: form.delivery_available && <Input label="Delivery fee" type="number" leftIcon={<span className="text-xs font-bold">₱</span>} value={form.delivery_fee} onChange={(e) => set('delivery_fee', e.target.value)} wrapperClassName="mt-3 max-w-xs" /> },
                  { k: 'pet_friendly' as const, t: 'Pet-friendly', s: 'Allow renters to bring pets.' },
                ].map((o) => (
                  <div key={o.k}>
                    <div className="flex items-center justify-between gap-4">
                      <div><p className="text-sm font-semibold">{o.t}</p><p className="text-xs text-ink-500">{o.s}</p></div>
                      <Switch checked={form[o.k]} onChange={(val) => set(o.k, val)} label={o.t} />
                    </div>
                    {o.extra}
                  </div>
                ))}
              </Card>
            </>
          )}

          {step === 2 && (
            <>
              <Card className="p-5 sm:p-6">
                <h2 className="text-lg font-bold">Where will renters pick it up?</h2>
                <p className="text-sm text-ink-500">Choose a ByaheGo hub or your own spot. Renters see the area before booking, and the exact spot after.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    { v: 'hub' as const, icon: Store, t: 'ByaheGo hub', s: 'Drop it at a hub – our staff hand over the keys and check the car after each trip.' },
                    { v: 'own' as const, icon: MapPin, t: 'My own location', s: 'Meet renters at your home, office or a nearby landmark.' },
                  ].map((o) => (
                    <button key={o.v} type="button" onClick={() => set('pickup_type', o.v)} className={cn('rounded-2xl border p-4 text-left transition', form.pickup_type === o.v ? 'border-brand bg-brand-tint ring-2 ring-brand/15' : 'border-line-200 hover:border-ink-400')}>
                      <o.icon className="size-5 text-brand" /><p className="mt-2 font-semibold">{o.t}</p><p className="text-xs text-ink-500">{o.s}</p>
                    </button>
                  ))}
                </div>
              </Card>
              {form.pickup_type === 'hub' ? (
                <Card className="p-5 sm:p-6">
                  <h2 className="text-lg font-bold">Choose a hub</h2>
                  {errors.hub_id && <p className="mt-1 text-xs font-medium text-danger">{errors.hub_id}</p>}
                  <div className="mt-4 space-y-2.5">
                    {hubs.data?.map((h) => (
                      <label key={h.id} className={cn('flex cursor-pointer gap-3 rounded-2xl border p-4 transition', form.hub_id === h.id ? 'border-brand bg-brand-tint' : 'border-line-200 hover:border-ink-400')}>
                        <input type="radio" name="hub" className="mt-1 accent-brand" checked={form.hub_id === h.id} onChange={() => set('hub_id', h.id)} />
                        <span className="flex-1">
                          <span className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{h.name}</span><span className="text-xs text-success">Open daily, {h.hours}</span></span>
                          <span className="block text-sm text-ink-500">{h.address}, {h.city}</span>
                          {h.parking_notes && <span className="mt-1 block text-xs text-ink-400">{h.parking_notes}</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                </Card>
              ) : (
                <Card className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
                  <Select label="City" value={form.city} onChange={(e) => set('city', e.target.value)} options={CITIES.map((c) => ({ value: c, label: c }))} />
                  <Input label="Landmark or street" value={form.pickup_address} onChange={(e) => set('pickup_address', e.target.value)} error={errors.pickup_address} placeholder="e.g. near Gaisano Mactan, Pusok" />
                  <div className="sm:col-span-2">
                    <Button variant="secondary" size="sm" loading={geo.loading} icon={<LocateFixed className="size-4" />} onClick={async () => { const c = await geo.request(); if (c) { set('lat', c.lat); set('lng', c.lng); toast.success('Pin set to your current location') } else toast.error('We couldn\'t get your location – we\'ll use the city center.') }}>
                      Use my current location for the map pin
                    </Button>
                    <p className="mt-1.5 text-xs text-ink-500">{form.lat ? `Pin: ${form.lat.toFixed(4)}, ${form.lng?.toFixed(4)}` : `If you skip this, the pin goes to the center of ${form.city}.`}</p>
                  </div>
                </Card>
              )}
            </>
          )}

          {step === 3 && (
            <Card className="p-5 sm:p-6">
              <h2 className="text-lg font-bold">Add the plate and papers</h2>
              <p className="text-sm text-ink-500">We verify registration before every listing goes live. Only our team can see these.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Input label="Plate number" value={form.plate_number} onChange={(e) => set('plate_number', e.target.value.toUpperCase())} error={errors.plate_number} placeholder="ABC 1234" wrapperClassName="sm:col-span-2 sm:max-w-xs" />
                <ImageUploader purpose="vehicle_or" label="Official Receipt (OR)" value={form.or_media_id} onChange={(v) => set('or_media_id', v)} error={errors.or_media_id} hint="Latest LTO registration payment" />
                <ImageUploader purpose="vehicle_cr" label="Certificate of Registration (CR)" value={form.cr_media_id} onChange={(v) => set('cr_media_id', v)} error={errors.cr_media_id} hint="Shows the registered owner" />
                <ImageUploader purpose="vehicle_ctpl" label="CTPL insurance" value={form.ctpl_media_id} onChange={(v) => set('ctpl_media_id', v)} error={errors.ctpl_media_id} hint="Compulsory Third Party Liability certificate" />
                <Input label="CTPL valid until" type="date" value={form.ctpl_expiry} onChange={(e) => set('ctpl_expiry', e.target.value)} error={errors.ctpl_expiry} />
              </div>
            </Card>
          )}

          {step === 4 && (
            <Card className="divide-y divide-line-100">
              {[
                { s: 0, t: 'Vehicle', rows: [[`${form.make} ${form.model} ${form.year}`, `${typeLabel(form.type)} · ${form.seats} seats · ${capitalize(form.transmission)} · ${capitalize(form.fuel)}`], ['Features', form.features.join(', ') || '—'], ['Photos', `${form.photo_ids.length} photo(s)`]] },
                { s: 1, t: 'Pricing', rows: [['Daily rate', form.daily_rate ? peso(Number(form.daily_rate)) : '—'], ['Weekly rate', form.weekly_rate ? peso(Number(form.weekly_rate)) : '—'], ['Deposit · late fee', `${peso(Number(form.security_deposit))} · ${peso(Number(form.late_fee_per_hour))}/hour`], ['Driver', form.with_driver_available ? `${peso(Number(form.driver_fee_per_day))}/day` : 'Self-drive only']] },
                { s: 2, t: 'Pick-up', rows: [[form.pickup_type === 'hub' ? 'ByaheGo hub' : 'Own location', form.pickup_type === 'hub' ? (hub ? `${hub.name}, ${hub.city}` : '—') : `${form.pickup_address}, ${form.city}`]] },
                { s: 3, t: 'Registration', rows: [['Plate', form.plate_number || '—'], ['OR / CR / CTPL', form.or_media_id && form.cr_media_id && form.ctpl_media_id ? 'Uploaded ✓' : 'Missing']] },
              ].map((g) => (
                <div key={g.t} className="p-5">
                  <div className="flex items-center justify-between"><p className="font-bold">{g.t}</p><button className="text-sm font-semibold text-brand" onClick={() => setStep(g.s)}>Edit</button></div>
                  <dl className="mt-2 space-y-1 text-sm">{g.rows.map(([a, b]) => <div key={a} className="flex justify-between gap-4"><dt className="text-ink-500">{a}</dt><dd className="text-right font-medium">{b}</dd></div>)}</dl>
                </div>
              ))}
            </Card>
          )}

          <div className="flex items-center justify-between">
            {step > 0 ? <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={() => setStep(step - 1)}>Back</Button> : <span />}
            {step < 4 ? (
              <Button loading={saving} onClick={() => void next()} icon={<ArrowRight className="size-4" />} className="flex-row-reverse">Continue to {STEPS[step + 1].toLowerCase()}</Button>
            ) : (
              <Button loading={saving} onClick={() => void submit()}>{['draft', 'rejected'].includes(status) ? 'Submit for review' : 'Save changes'}</Button>
            )}
          </div>
        </div>
        <aside className="hidden lg:block">{preview}</aside>
      </div>
    </section>
  )
}
