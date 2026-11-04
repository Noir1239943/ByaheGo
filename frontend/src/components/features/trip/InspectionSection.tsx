import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, ArrowRight, Check, Gauge, ImageOff, RotateCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ProtectedImage } from '@/components/common/ProtectedImage'
import { ErrorState, PageLoader } from '@/components/common/States'
import { Alert, Button, Card, Input, Textarea } from '@/components/ui'
import { cn } from '@/lib/cn'
import { getErrorMessage, getFieldErrors } from '@/lib/api'
import { formatDateTime, peso } from '@/lib/format'
import { FUEL_STEPS, watermarkText, type CaptureMeta } from '@/lib/trip/capture'
import { bookingService } from '@/services/bookings'
import { tripService, type TripStage } from '@/services/trip'
import type { ShotAngle } from '@/types'
import { GuidedCamera } from './GuidedCamera'
import { STALE } from '@/lib/constants'

const TEXT: Record<TripStage, { title: string; intro: string; done: string }> = {
  checkin: {
    title: 'Check-in photos',
    intro: 'Take 10 quick photos of the car before you drive off. They protect you from being blamed for damage that was already there.',
    done: 'Check-in submitted. Your host has been told. You can start the trip once you have the keys.',
  },
  checkout: {
    title: 'Return photos',
    intro: 'Take the same 10 photos again so you and your host can compare the car before and after. Match each angle to the faint check-in photo.',
    done: 'Return photos submitted. Your host will review them, and your deposit is settled after that.',
  },
}

/** The guided camera walkthrough: one shot per screen, then the odometer and fuel level. */
export function InspectionSection() {
  const { reference = '', stage: stageParam = '' } = useParams()
  const stage: TripStage = stageParam === 'checkout' ? 'checkout' : 'checkin'
  const navigate = useNavigate()
  const qc = useQueryClient()
  const booking = useQuery({ queryKey: ['booking', reference], queryFn: () => bookingService.get(reference), staleTime: STALE.live })
  const wizard = useQuery({ queryKey: ['wizard', reference, stage], queryFn: () => tripService.wizard(reference, stage), refetchOnWindowFocus: false, staleTime: STALE.live })
  const [index, setIndex] = useState(0)
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [retaking, setRetaking] = useState(false)
  const [odometer, setOdometer] = useState('')
  const [fuel, setFuel] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [damageNote, setDamageNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const upload = useMutation({
    mutationFn: ({ angle, blob, meta, note }: { angle: string; blob: Blob; meta: CaptureMeta; note?: string }) =>
      tripService.uploadPhoto(reference, stage, blob, { angle, live: meta.live, device_time: meta.device_time, lat: meta.lat, lng: meta.lng, note }),
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: (id: number) => tripService.deletePhoto(reference, stage, id),
    onSuccess: () => void wizard.refetch(),
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const submit = useMutation({
    mutationFn: () => tripService.submit(reference, stage, { odometer: Number(odometer), fuel_level: fuel ?? -1, notes: notes || undefined }),
    onSuccess: () => {
      toast.success(TEXT[stage].done)
      void qc.invalidateQueries({ queryKey: ['booking', reference] })
      void qc.invalidateQueries({ queryKey: ['trips'] })
      navigate(`/account/trips/${reference}`, { replace: true })
    },
    onError: (e) => { setErrors(getFieldErrors(e)); toast.error(getErrorMessage(e)) },
  })

  const angles = wizard.data?.angles
  const drafts = wizard.data?.drafts
  const draftOf = useMemo(() => new Map((drafts ?? []).filter((d) => d.angle !== 'damage').map((d) => [d.angle, d])), [drafts])
  const closeups = (drafts ?? []).filter((d) => d.angle === 'damage')

  if (wizard.isLoading || booking.isLoading) return <PageLoader label="Getting the camera ready…" />
  if (wizard.error || !wizard.data || !booking.data || !angles) return <div className="container-page py-10"><ErrorState error={wizard.error ?? booking.error} onRetry={() => void wizard.refetch()} /></div>

  const w = wizard.data
  const b = booking.data
  const back = <Link to={`/account/trips/${reference}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"><ArrowLeft className="size-4" /> Back to my trip</Link>

  if (w.submitted) {
    return <section className="container-page max-w-2xl py-8">{back}<Alert tone="success" className="mt-4" title={`${TEXT[stage].title} already submitted`}>These photos can't be changed once they are submitted. You can see them on your trip page.</Alert></section>
  }
  if (!w.can_start) {
    return (
      <section className="container-page max-w-2xl py-8">
        {back}
        <Alert tone="warning" className="mt-4" title={stage === 'checkin' ? 'Check-in is not open yet' : 'Return photos are not available'}>
          {stage === 'checkin' && w.opens_at ? `Check-in opens ${formatDateTime(w.opens_at)}, 12 hours before pick-up.` : 'This step is only available while the trip is running and after check-in.'}
        </Alert>
      </section>
    )
  }

  const total = angles.length
  const readingsStep = index >= total
  const current = angles[Math.min(index, total - 1)]
  const draft = draftOf.get(current.key)
  const missing = angles.filter((a) => !draftOf.has(a.key))
  const late = b.trip.late
  const stamp = (label: string) => watermarkText(reference, label)

  const onCapture = async (angle: string, blob: Blob, meta: CaptureMeta, note?: string) => {
    const old = draftOf.get(angle as ShotAngle)
    try {
      await upload.mutateAsync({ angle, blob, meta, note })
    } catch { return }
    if (angle !== 'damage') setPreviews((p) => ({ ...p, [angle]: URL.createObjectURL(blob) }))
    if (old && angle === 'damage') void remove.mutate(old.id)
    setRetaking(false)
    await wizard.refetch()
    if (angle === 'damage') setDamageNote('')
    if (!meta.live) toast.info('Saved as "uploaded, not live". Your host and our team can see that it was not taken with the live camera.')
  }

  const readingsOk = odometer !== '' && fuel !== null && missing.length === 0

  return (
    <section className="container-page max-w-3xl py-6">
      {back}
      <h1 className="mt-3 text-2xl font-extrabold tracking-tight">{TEXT[stage].title}</h1>
      <p className="mt-1 text-sm text-ink-500">{b.vehicle.name} · {reference}. {TEXT[stage].intro}</p>

      {stage === 'checkout' && late.is_overdue && (
        <Alert tone="danger" className="mt-4" title={`You're ${late.hours} hour${late.hours === 1 ? '' : 's'} past the return time`}>
          Excess hours are counted from the moment you submit these photos: {peso(late.per_hour)} per hour after a {late.grace_minutes}-minute grace period{late.full_day_after_hours ? `, and ${late.full_day_after_hours}+ hours counts as a full extra day` : ''}. It is taken from your deposit.
        </Alert>
      )}

      <ol className="mt-5 flex flex-wrap gap-1.5" aria-label="Photo steps">
        {angles.map((a, i) => (
          <li key={a.key}>
            <button
              type="button"
              onClick={() => { if (i <= index || draftOf.has(a.key)) { setIndex(i); setRetaking(false) } }}
              className={cn('flex size-8 items-center justify-center rounded-full text-xs font-bold transition', i === index && !readingsStep ? 'bg-brand text-white ring-2 ring-brand/30' : draftOf.has(a.key) ? 'bg-success-soft text-success' : 'bg-line-100 text-ink-500')}
              aria-label={`${a.label}${draftOf.has(a.key) ? ' (done)' : ''}`}
            >
              {draftOf.has(a.key) ? <Check className="size-4" strokeWidth={3} /> : i + 1}
            </button>
          </li>
        ))}
        <li>
          <button type="button" onClick={() => missing.length === 0 && setIndex(total)} className={cn('flex h-8 items-center gap-1 rounded-full px-3 text-xs font-bold', readingsStep ? 'bg-brand text-white' : 'bg-line-100 text-ink-500')}><Gauge className="size-3.5" /> Readings</button>
        </li>
      </ol>

      {!readingsStep ? (
        <Card className="mt-4 p-4 sm:p-5">
          <p className="mb-3 text-sm font-semibold">Photo {index + 1} of {total}: {current.label}</p>
          {draft && !retaking ? (
            <div>
              {previews[current.key] ? <img src={previews[current.key]} alt={current.label} className="aspect-[4/3] w-full rounded-2xl object-cover sm:aspect-video" data-testid="shot-preview" /> : <ProtectedImage id={draft.media_id} alt={current.label} width={960} className="aspect-[4/3] w-full sm:aspect-video" />}
              <p className="mt-2 text-xs text-ink-500">{draft.live ? 'Taken with the live camera.' : 'Uploaded, not live. This will be shown on the photo.'}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Button variant="secondary" icon={<RotateCcw className="size-4" />} onClick={() => setRetaking(true)}>Retake</Button>
                <Button icon={<ArrowRight className="size-4" />} onClick={() => setIndex(index + 1)} data-testid="next-shot">{index + 1 < total ? 'Next photo' : 'Continue to readings'}</Button>
              </div>
            </div>
          ) : (
            <GuidedCamera
              key={current.key}
              angle={current.key}
              label={current.label}
              ghostMediaId={w.ghosts[current.key] ?? null}
              stamp={stamp}
              busy={upload.isPending}
              onCapture={(blob, meta) => void onCapture(current.key, blob, meta)}
              hint={current.key === 'engine' ? 'Open the hood and show the whole engine bay, including the battery.' : current.key === 'trunk' ? 'Show the spare tire and tools in the trunk.' : current.key === 'odometer' ? 'Fill the frame with the odometer so the numbers are readable.' : current.key === 'fuel' ? 'Show the fuel gauge clearly.' : 'Stand back so the whole car (or area) fits inside the outline.'}
            />
          )}
        </Card>
      ) : (
        <Card className="mt-4 space-y-5 p-4 sm:p-5">
          <div>
            <h2 className="font-bold">Odometer and fuel</h2>
            <p className="text-sm text-ink-500">Type what the dashboard shows right now.{w.checkin_odometer != null && ` At check-in it was ${w.checkin_odometer.toLocaleString()} km.`}</p>
          </div>
          <Input label="Odometer (km)" type="number" inputMode="numeric" min={0} value={odometer} onChange={(e) => setOdometer(e.target.value)} error={errors.odometer} />
          <div>
            <p className="mb-2 text-sm font-semibold">Fuel level</p>
            <div className="flex gap-2" role="radiogroup" aria-label="Fuel level">
              {FUEL_STEPS.map((f) => (
                <button key={f.value} type="button" role="radio" aria-checked={fuel === f.value} onClick={() => setFuel(f.value)} className={cn('h-11 flex-1 rounded-xl border text-base font-bold transition', fuel === f.value ? 'border-brand bg-brand-tint text-brand ring-2 ring-brand/15' : 'border-line-200 text-ink-700 hover:border-ink-400')}>{f.label}</button>
              ))}
            </div>
            {errors.fuel_level && <p className="mt-1 text-xs text-danger">{errors.fuel_level}</p>}
            {stage === 'checkout' && w.checkin_fuel_level != null && <p className="mt-1 text-xs text-ink-500">At check-in the tank was {FUEL_STEPS.find((f) => f.value === w.checkin_fuel_level)?.label ?? `${w.checkin_fuel_level}%`}.</p>}
          </div>

          <div>
            <h3 className="font-semibold">Damage close-ups <span className="font-normal text-ink-500">(optional)</span></h3>
            <p className="text-sm text-ink-500">Found a scratch or dent? Take a close-up and say what it is. You can add up to 10.</p>
            {closeups.length > 0 && (
              <ul className="mt-3 grid gap-3 sm:grid-cols-3">
                {closeups.map((c) => (
                  <li key={c.id} className="rounded-xl border border-line-200 p-2">
                    <ProtectedImage id={c.media_id} alt="Damage close-up" width={480} className="aspect-[4/3] w-full" />
                    <p className="mt-1 truncate text-xs text-ink-700">{c.note ?? 'No note'}</p>
                    <button type="button" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-danger" onClick={() => remove.mutate(c.id)}><Trash2 className="size-3" /> Remove</button>
                  </li>
                ))}
              </ul>
            )}
            {closeups.length < 10 && (
              <div className="mt-3 space-y-3">
                <Input label="What does it show?" value={damageNote} onChange={(e) => setDamageNote(e.target.value)} placeholder="e.g. Scratch on the rear bumper" />
                <GuidedCamera angle="damage" label="Damage close-up" stamp={stamp} busy={upload.isPending} onCapture={(blob, meta) => void onCapture('damage', blob, meta, damageNote)} hint="Get close enough that the damage fills the picture." />
              </div>
            )}
          </div>

          <Textarea label="Anything else to tell your host? (optional)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          {errors.photos && <Alert tone="danger">{errors.photos}</Alert>}
          {errors.booking && <Alert tone="danger">{errors.booking}</Alert>}
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" icon={<ArrowLeft className="size-4" />} onClick={() => setIndex(total - 1)}>Back to photos</Button>
            <Button size="lg" loading={submit.isPending} disabled={!readingsOk} onClick={() => submit.mutate()} data-testid="submit-inspection">Submit {stage === 'checkin' ? 'check-in' : 'return photos'}</Button>
          </div>
          {!readingsOk && missing.length > 0 && <p className="flex items-center gap-1.5 text-xs text-warning"><ImageOff className="size-3.5" /> Still needed: {missing.map((m) => m.label).join(', ')}.</p>}
          <p className="text-xs text-ink-500">Once submitted, these photos can't be changed or removed. Each photo records the time, your phone's clock and, if you allowed it, the location.</p>
        </Card>
      )}
    </section>
  )
}
