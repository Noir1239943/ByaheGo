import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { AlertTriangle, ArrowLeft, BadgeCheck, CalendarDays, Camera, CheckCircle2, ClipboardCheck, Clock, Download, KeyRound, MapPin, Phone, Siren, Undo2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { InfoRow, KeyValue } from '@/components/common/InfoRow'
import { ErrorState, PageLoader } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { tripStatus } from '@/lib/status'
import { VehicleImage } from '@/components/common/VehicleImage'
import { DepositCard } from '@/components/features/bookings/DepositCard'
import { IncidentsList } from '@/components/features/bookings/IncidentsList'
import { InspectionsList } from '@/components/features/bookings/InspectionsList'
import { TripTimeline } from '@/components/features/bookings/TripTimeline'
import { Alert, Avatar, Button, Card, CardBody, CardHeader, Checkbox, Input, Modal, Select, Textarea } from '@/components/ui'
import { getErrorMessage, getFieldErrors } from '@/lib/api'
import { downloadFile } from '@/lib/download'
import { INSPECTION_ITEMS, STALE } from '@/lib/constants'
import { formatDate, formatDateTime, localToIso, peso, toLocalInput } from '@/lib/format'
import { hostService } from '@/services/host'
import { tripService } from '@/services/trip'
import { GuidedCamera } from '@/components/features/trip/GuidedCamera'
import { PhotoCompare } from '@/components/features/trip/PhotoCompare'
import { HostStatusLine, TripPhotos } from '@/components/features/trip/TripPhotos'
import { watermarkText } from '@/lib/trip/capture'
import type { DamagePin } from '@/types'

type InspectionForm = { odometer: string; fuel_level: string; checklist: Record<string, boolean>; notes: string; actual_return_at: string; damage_reported: boolean; damage_type: string; damage_description: string; damage_amount: string }

export function HostBookingDetailSection() {
  const { reference = '' } = useParams()
  const qc = useQueryClient()
  const { data: b, isLoading, error, refetch } = useQuery({ queryKey: ['host', 'booking', reference], queryFn: () => hostService.booking(reference), staleTime: STALE.live })
  const [modal, setModal] = useState<null | 'pickup' | 'return' | 'incident' | 'cancel' | 'review' | 'issue' | 'photo' | 'notreturned' | 'confirm'>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const blank = (): InspectionForm => ({
    odometer: '', fuel_level: '100', checklist: Object.fromEntries(INSPECTION_ITEMS.map((i) => [i.key, true])), notes: '',
    actual_return_at: toLocalInput(new Date()), damage_reported: false, damage_type: 'damage', damage_description: '', damage_amount: '',
  })
  const [form, setForm] = useState<InspectionForm>(blank)
  const [incident, setIncident] = useState({ type: 'damage', description: '', amount_claimed: '' })
  const [cancelReason, setCancelReason] = useState('')
  const [pins, setPins] = useState<DamagePin[]>([])
  const [issue, setIssue] = useState({ type: 'damage', description: '', amount: '' })
  const [confirmNote, setConfirmNote] = useState('')

  const done = (msg: string) => {
    toast.success(msg)
    setModal(null)
    setErrors({})
    void qc.invalidateQueries({ queryKey: ['host'] })
  }
  const onErr = (e: unknown) => { setErrors(getFieldErrors(e)); toast.error(getErrorMessage(e)) }
  const pickup = useMutation({ mutationFn: () => hostService.pickup(reference, { odometer: Number(form.odometer), fuel_level: Number(form.fuel_level), checklist: form.checklist, notes: form.notes }), onSuccess: () => done('Handover recorded. Enjoy the trip, renter!'), onError: onErr })
  const ret = useMutation({
    mutationFn: () => hostService.return(reference, {
      odometer: Number(form.odometer), fuel_level: Number(form.fuel_level), checklist: form.checklist, notes: form.notes, actual_return_at: localToIso(form.actual_return_at),
      damage_reported: form.damage_reported, damage_type: form.damage_type, damage_description: form.damage_description, damage_amount: form.damage_amount ? Number(form.damage_amount) : null,
    }),
    onSuccess: (r) => done(r.deposit_status === 'on_hold' ? 'Return recorded. Your damage report is with our team.' : r.late_fee > 0 ? `Return recorded. Late fee of ${peso(r.late_fee)} added to your payout.` : 'Return recorded. Your payout is scheduled.'),
    onError: onErr,
  })
  const confirmCheckin = useMutation({ mutationFn: () => hostService.confirmCheckin(reference, confirmNote || undefined), onSuccess: () => done('Thanks! The condition at check-in is confirmed.'), onError: onErr })
  const addPhoto = useMutation({
    mutationFn: ({ blob, meta }: { blob: Blob; meta: { live: boolean; device_time: string; lat: number | null; lng: number | null } }) => tripService.hostAddPhoto(reference, blob, meta),
    onSuccess: () => done('Your photo was added to the check-in.'),
    onError: onErr,
  })
  const acceptReturn = useMutation({
    mutationFn: () => hostService.reviewReturn(reference, { decision: 'accept' }),
    onSuccess: (r) => done(r.late_fee > 0 ? `Trip completed. Excess-hours fee of ${peso(r.late_fee)} added to your payout.` : 'Trip completed. The deposit goes back to the renter and your payout is scheduled.'),
    onError: onErr,
  })
  const reportIssue = useMutation({
    mutationFn: () => hostService.reviewReturn(reference, { decision: 'issue', type: issue.type, description: issue.description, amount: issue.amount ? Number(issue.amount) : 0, pins }),
    onSuccess: () => { setPins([]); done('Issue reported. The deposit stays held while our team reviews the photos and your pins.') },
    onError: onErr,
  })
  const answerExtension = useMutation({ mutationFn: ({ id, approve }: { id: number; approve: boolean }) => hostService.respondExtension(reference, id, approve), onSuccess: (r) => done(r.trip.extension?.status === 'approved' ? 'Approved. The renter now has to pay for the extra time; the return time changes once they have.' : 'Extension declined.'), onError: onErr })
  const notReturned = useMutation({ mutationFn: () => hostService.notReturned(reference), onSuccess: () => done('Reported. The renter is on hold and our team has been alerted.'), onError: onErr })
  const cancelTrip = useMutation({ mutationFn: () => hostService.cancelBooking(reference, cancelReason), onSuccess: () => done('Booking cancelled. The renter gets a full refund.'), onError: onErr })
  const report = useMutation({ mutationFn: () => hostService.incident(reference, { ...incident, amount_claimed: incident.amount_claimed ? Number(incident.amount_claimed) : 0 }), onSuccess: () => done('Report sent to our team.'), onError: onErr })

  if (isLoading) return <PageLoader />
  if (error || !b) return <ErrorState error={error} onRetry={() => void refetch()} />
  const v = b.vehicle
  const s = tripStatus(b)
  const lastOdo = b.inspections.find((i) => i.stage === 'pickup')?.odometer

  const inspectionFields = (stage: 'pickup' | 'return') => (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Odometer (km)" type="number" inputMode="numeric" value={form.odometer} onChange={(e) => setForm({ ...form, odometer: e.target.value })} error={errors.odometer} hint={stage === 'return' && lastOdo ? `At pick-up: ${lastOdo.toLocaleString()} km` : undefined} />
        <Select label="Fuel level" value={form.fuel_level} onChange={(e) => setForm({ ...form, fuel_level: e.target.value })} options={[['100', 'Full'], ['88', '7/8'], ['75', '3/4'], ['50', '1/2'], ['25', '1/4'], ['10', 'Almost empty']].map(([value, label]) => ({ value, label }))} />
        {stage === 'return' && <Input label="Actual return time" type="datetime-local" max={toLocalInput(new Date())} value={form.actual_return_at} onChange={(e) => setForm({ ...form, actual_return_at: e.target.value })} error={errors.actual_return_at} hint={`Scheduled: ${formatDateTime(b.return_at)}`} wrapperClassName="sm:col-span-2" />}
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold">Walk-around checklist</p>
        <div className="space-y-2 rounded-2xl border border-line-200 p-3">
          {INSPECTION_ITEMS.map((i) => (
            <Checkbox key={i.key} label={i.label} checked={form.checklist[i.key]} onChange={(e) => setForm({ ...form, checklist: { ...form.checklist, [i.key]: e.target.checked } })} />
          ))}
        </div>
      </div>
      <Textarea label="Notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Existing scratches, items in the car, anything worth noting" optional />
      {stage === 'return' && (
        <div className="rounded-2xl border border-line-200 p-4">
          <Checkbox label="Report damage or missing items" description="The deposit stays on hold while our team reviews your claim." checked={form.damage_reported} onChange={(e) => setForm({ ...form, damage_reported: e.target.checked })} />
          {form.damage_reported && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Select label="Type" value={form.damage_type} onChange={(e) => setForm({ ...form, damage_type: e.target.value })} options={[{ value: 'damage', label: 'Damage' }, { value: 'missing_parts', label: 'Missing parts / accessories' }, { value: 'other', label: 'Other' }]} />
              <Input label="Estimated cost" type="number" leftIcon={<span className="text-xs font-bold">₱</span>} value={form.damage_amount} onChange={(e) => setForm({ ...form, damage_amount: e.target.value })} error={errors.damage_amount} />
              <Textarea label="What happened?" rows={3} value={form.damage_description} onChange={(e) => setForm({ ...form, damage_description: e.target.value })} error={errors.damage_description} wrapperClassName="sm:col-span-2" placeholder="e.g. Deep scratch on rear bumper, not in pick-up photos" />
            </div>
          )}
        </div>
      )}
    </div>
  )

  return (
    <section className="space-y-5">
      <Link to="/host/bookings" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"><ArrowLeft className="size-4" /> All bookings</Link>
      <Card>
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
          <div className="h-28 overflow-hidden rounded-2xl sm:w-40 sm:shrink-0"><VehicleImage photo={v.photo} type={v.type} color={v.color_hex} alt={v.name} /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><StatusBadge status={s} /><span className="text-sm text-ink-500">{b.reference}</span></div>
            <h2 className="mt-1 text-xl font-extrabold">{v.name}</h2>
            <p className="text-sm text-ink-500">{formatDateTime(b.pickup_at)} → {formatDateTime(b.return_at)} · {b.days} day(s)</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-col">
            {b.status === 'confirmed' && <Button icon={<KeyRound className="size-4" />} disabled={!b.trip.checkin} title={b.trip.checkin ? undefined : 'The renter must submit the check-in photos first'} onClick={() => { setForm(blank()); setModal('pickup') }}>Start handover</Button>}
            {b.status === 'active' && b.trip.checkout && <Button icon={<CheckCircle2 className="size-4" />} onClick={() => setModal('review')}>Review the return</Button>}
            {b.status === 'active' && !b.trip.checkout && <Button variant="secondary" icon={<Undo2 className="size-4" />} onClick={() => { setForm(blank()); setModal('return') }}>Record return by hand</Button>}
            {['active', 'completed'].includes(b.status) && <Button variant="secondary" icon={<AlertTriangle className="size-4" />} onClick={() => setModal('incident')}>Report incident</Button>}
            {b.agreement.has_copy && <Button variant="secondary" icon={<Download className="size-4" />} onClick={() => void downloadFile(`/host/bookings/${b.reference}/agreement.pdf`, `ByaheGo-agreement-${b.reference}.pdf`).catch((e) => toast.error(getErrorMessage(e)))}>Agreement PDF</Button>}
            {['confirmed', 'active'].includes(b.status) && <Button variant="danger-outline" icon={<XCircle className="size-4" />} onClick={() => { setCancelReason(''); setModal('cancel') }}>Cancel booking</Button>}
          </div>
        </div>
        <div className="border-t border-line-100 bg-page/50 p-5 sm:p-6"><TripTimeline b={b} /></div>
      </Card>
      {s === 'overdue' && <Alert tone="danger" title={`Return is overdue by ${b.trip.overdue_hours} hour(s)`} action={b.trip.can_report_not_returned ? <Button size="sm" variant="danger" icon={<Siren className="size-4" />} onClick={() => setModal('notreturned')}>Car not returned</Button> : undefined}>
        Call the renter. Excess-hours fees are added automatically when the renter submits the return photos.{!b.trip.can_report_not_returned && ` If the car still isn't back ${b.trip.not_returned_after_hours} hours after the return time (and you haven't approved an extension), you can report "Car not returned" here.`}
      </Alert>}
      {b.status === 'confirmed' && !b.trip.checkin && <Alert tone="info" icon={<Camera />} title="Waiting for the renter's check-in photos">The renter photographs the car in the app just before pick-up. You can start the handover once they are in.</Alert>}
      {b.trip.checkin?.host_status === 'pending' && ['confirmed', 'active'].includes(b.status) && (
        <Alert tone="brand" icon={<Camera />} title="Check the check-in photos" action={<div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => { setConfirmNote(''); setModal('confirm') }}>Confirm condition</Button><Button size="sm" variant="secondary" onClick={() => setModal('photo')}>Add my photo</Button></div>}>
          Compare them with the car in front of you. Confirm them, add your own photos or notes{b.trip.checkin.host_window_ends_at ? ` before ${formatDateTime(b.trip.checkin.host_window_ends_at)}` : ''}; if you say nothing, they are accepted automatically.
        </Alert>
      )}
      {b.status === 'active' && b.trip.checkout && (
        <Alert tone="warning" icon={<CheckCircle2 />} title="The renter returned the car" action={<Button size="sm" onClick={() => setModal('review')}>Review the return</Button>}>
          Compare the before and after photos{b.trip.host_review_due_at ? `. Decide by ${formatDateTime(b.trip.host_review_due_at)}, or the trip completes automatically and the deposit is released` : ''}.
          {b.trip.late.fee > 0 && ` Excess hours: ${b.trip.late.hours} h = ${peso(b.trip.late.fee)} (added to your payout, taken from the renter's deposit).`}
        </Alert>
      )}
      {b.trip.extension?.status === 'pending' && b.status === 'active' && (
        <Alert tone="info" icon={<Clock />} title="The renter asks for more time" action={<div className="flex gap-2"><Button size="sm" loading={answerExtension.isPending} onClick={() => answerExtension.mutate({ id: b.trip.extension!.id, approve: true })}>Approve</Button><Button size="sm" variant="secondary" loading={answerExtension.isPending} onClick={() => answerExtension.mutate({ id: b.trip.extension!.id, approve: false })}>Decline</Button></div>}>
          New return time: <b>{formatDateTime(b.trip.extension.requested_return_at)}</b> (now {formatDateTime(b.trip.extension.previous_return_at)}).{b.trip.extension.note ? ` “${b.trip.extension.note}”` : ''} The renter pays <b>{peso(b.trip.extension.amount)}</b> for the extra {b.trip.extension.hours} hour(s) (your per-hour rate, full days at the daily rate). If you approve, the return time moves only after they have paid; if they don't pay before {formatDateTime(b.trip.extension.previous_return_at)} it lapses and normal late fees apply.
        </Alert>
      )}
      {b.trip.extension?.status === 'awaiting_payment' && b.status === 'active' && <Alert tone="info" icon={<Clock />} title="Extension approved, waiting for the renter to pay">The renter must pay {peso(b.trip.extension.amount)} before {formatDateTime(b.trip.extension.previous_return_at)}. The return time changes only when the payment goes through.</Alert>}
      {b.trip.extension?.status === 'lapsed' && b.status === 'active' && <Alert tone="warning" title="The extension lapsed">The renter did not pay in time, so the original return time stands and normal late fees apply.</Alert>}

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Renter" />
            <CardBody className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Avatar initials={b.renter?.initials ?? '?'} size="lg" seed={b.renter?.id} />
                <div>
                  <p className="flex items-center gap-1.5 font-bold">{b.renter?.name} {b.renter?.verification_status === 'verified' && <BadgeCheck className="size-4 text-brand" />}</p>
                  <p className="text-sm text-ink-500">{b.rental_type === 'driver' ? 'Trip with your driver' : `Driver: ${b.driver.name}`}{b.driver.license_no && ` · License ${b.driver.license_no}`}</p>
                </div>
              </div>
              {b.driver.phone && <Button variant="secondary" icon={<Phone className="size-4" />} onClick={() => (window.location.href = `tel:${b.driver.phone}`)}>{b.driver.phone}</Button>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Trip details" />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <InfoRow icon={<CalendarDays />} label="Pick-up" value={formatDateTime(b.pickup_at)} />
              <InfoRow icon={<CalendarDays />} label="Return" value={formatDateTime(b.return_at)} />
              <InfoRow icon={<MapPin />} label="Location" value={b.pickup_label} />
              <InfoRow icon={<ClipboardCheck />} label="Protection" value={`${b.protection.name} (renter pays up to ${peso(b.protection.liability_cap)})`} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Check-in and return photos" description="Taken by the renter with the live camera. They can't be edited after they are submitted." />
            <CardBody className="space-y-3"><TripPhotos trip={b.trip} /><HostStatusLine inspection={b.trip.checkin} /></CardBody>
          </Card>
          <Card>
            <CardHeader title="Handover records" description="Your own pick-up and return checklists" />
            <CardBody><InspectionsList inspections={b.inspections} /></CardBody>
          </Card>
          {b.incidents.length > 0 && <Card><CardHeader title="Incidents" /><CardBody><IncidentsList incidents={b.incidents} /></CardBody></Card>}
        </div>
        <aside className="space-y-5">
          <Card className="p-5">
            <p className="font-bold">Your earnings</p>
            <div className="mt-2 divide-y divide-line-100">
              <KeyValue label={`Rental (${b.days} days)`} value={peso(b.rental_subtotal)} />
              {b.driver_fee_total > 0 && <KeyValue label="Driver fee" value={peso(b.driver_fee_total)} />}
              <KeyValue label="ByaheGo commission (15%)" value={`−${peso(b.commission ?? 0)}`} />
              {b.late_fee > 0 && <KeyValue label="Late return fee" value={peso(b.late_fee)} />}
              {b.damage_charge > 0 && <KeyValue label="Approved damage" value={peso(b.damage_charge)} />}
              <KeyValue label="Your payout" value={peso(b.payout ? b.payout.amount : b.rental_subtotal + b.driver_fee_total - (b.commission ?? 0) + b.late_fee + b.damage_charge)} strong />
            </div>
            {b.payout && <p className="mt-3 rounded-xl bg-page p-3 text-xs text-ink-700">{b.payout.status === 'paid' ? `Paid on ${formatDateTime(b.payout.paid_at)}` : `Scheduled for ${formatDate(b.payout.scheduled_for)}`}</p>}
          </Card>
          {b.status !== 'cancelled' && <DepositCard b={b} />}
        </aside>
      </div>

      <Modal open={modal === 'confirm'} onClose={() => setModal(null)} title="Confirm the condition" description="You agree the car matches the renter's check-in photos and readings." size="sm" footer={<Button loading={confirmCheckin.isPending} onClick={() => confirmCheckin.mutate()}>Confirm</Button>}>
        <Textarea label="Note (optional)" rows={3} value={confirmNote} onChange={(e) => setConfirmNote(e.target.value)} placeholder="e.g. The scratch on the rear bumper was already there" />
      </Modal>
      <Modal open={modal === 'photo'} onClose={() => setModal(null)} title="Add your own photo" description="It is added next to the renter's photos. Existing photos are never replaced." size="lg">
        {modal === 'photo' && <GuidedCamera angle="front" label="Your photo" stamp={(l) => watermarkText(b.reference, l)} busy={addPhoto.isPending} onCapture={(blob, meta) => addPhoto.mutate({ blob, meta })} hint="Show anything you want on record: a scratch, the mileage, the fuel gauge." />}
      </Modal>
      <Modal open={modal === 'review'} onClose={() => setModal(null)} title="Review the return" description="Slide to compare before and after. Tap “Mark new damage” and then the photo to pin it. No AI and no automatic charges: you and our team decide." size="xl" footer={<><Button variant="secondary" onClick={() => setModal('issue')}>Report an issue</Button><Button loading={acceptReturn.isPending} onClick={() => acceptReturn.mutate()} data-testid="accept-return">All good, complete the trip</Button></>}>
        <PhotoCompare trip={b.trip} pins={pins} onPin={(p) => setPins([...pins, p])} onRemovePin={(i) => setPins(pins.filter((_, k) => k !== i))} />
        {b.trip.checkout?.notes && <p className="mt-3 rounded-lg bg-page p-2.5 text-xs text-ink-700">Renter's note: “{b.trip.checkout.notes}”</p>}
      </Modal>
      <Modal open={modal === 'issue'} onClose={() => setModal('review')} title="Report an issue" description="This opens a case with both photo sets, your pins, the readings and the timestamps. The deposit stays held until our team decides." size="lg" footer={<Button variant="danger" loading={reportIssue.isPending} disabled={issue.description.trim().length < 10} onClick={() => reportIssue.mutate()}>Send to our team</Button>}>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="What kind of issue?" value={issue.type} onChange={(e) => setIssue({ ...issue, type: e.target.value })} options={[{ value: 'damage', label: 'New damage' }, { value: 'missing_parts', label: 'Missing parts (battery, tires, tools...)' }, { value: 'theft', label: 'Something was stolen' }, { value: 'other', label: 'Other' }]} />
            <Input label="Estimated cost (optional)" type="number" leftIcon={<span className="text-xs font-bold">₱</span>} value={issue.amount} onChange={(e) => setIssue({ ...issue, amount: e.target.value })} />
          </div>
          <Textarea label="What is wrong?" rows={4} value={issue.description} onChange={(e) => setIssue({ ...issue, description: e.target.value })} error={errors.description} placeholder="e.g. New dent on the front bumper and the battery is not the original one." />
          <div>
            <p className="mb-1 text-sm font-semibold">Your pins ({pins.length})</p>
            {pins.length === 0 ? <p className="text-xs text-ink-500">No pins yet. Go back to the photos and tap “Mark new damage”, then the spot on the photo.</p> : (
              <ul className="space-y-2">
                {pins.map((p, i) => (
                  <li key={i} className="flex items-center gap-2"><span className="w-28 shrink-0 text-xs font-semibold capitalize">{p.angle.replace('_', ' ')}</span><Input aria-label={`Note for pin ${i + 1}`} value={p.note ?? ''} placeholder="What is here?" onChange={(e) => setPins(pins.map((x, k) => (k === i ? { ...x, note: e.target.value } : x)))} /></li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Modal>
      <Modal open={modal === 'notreturned'} onClose={() => setModal(null)} title="Report: car not returned" description="Use this only if you cannot reach the renter and the car is not back." size="sm" footer={<Button variant="danger" loading={notReturned.isPending} onClick={() => notReturned.mutate()}>Report as possible theft</Button>}>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-700">
          <li>The booking is flagged <b>Possible theft</b> and our admins are alerted right away.</li>
          <li>The renter is put on hold and told by notification and email.</li>
          <li>If you are in danger, or the car was stolen, call the PNP (911) first.</li>
        </ul>
      </Modal>
      <Modal open={modal === 'pickup'} onClose={() => setModal(null)} title="Start handover" description="Walk around the vehicle with the renter. Take photos of every side, then record what you see." size="lg" footer={<Button loading={pickup.isPending} disabled={!form.odometer} onClick={() => pickup.mutate()}>Confirm pick-up</Button>}>
        {inspectionFields('pickup')}
      </Modal>
      <Modal open={modal === 'return'} onClose={() => setModal(null)} title="Record return" description="Check the vehicle with the renter. Late fees are calculated automatically from the actual return time." size="lg" footer={<Button loading={ret.isPending} disabled={!form.odometer} onClick={() => ret.mutate()}>Confirm return</Button>}>
        {inspectionFields('return')}
      </Modal>
      <Modal open={modal === 'cancel'} onClose={() => setModal(null)} title="Cancel this booking?" description="The renter gets a full refund of the trip and the deposit, whenever you cancel. We record every host cancellation, and too many can put your listings under review." size="sm" footer={<><Button variant="secondary" onClick={() => setModal(null)}>Keep booking</Button><Button variant="danger" loading={cancelTrip.isPending} disabled={cancelReason.trim().length < 5} onClick={() => cancelTrip.mutate()}>Cancel and refund renter</Button></>}>
        <Textarea label="Why are you cancelling? (the renter sees this)" rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} error={errors.reason} />
      </Modal>
      <Modal open={modal === 'incident'} onClose={() => setModal(null)} title="Report an incident" description="For theft or an emergency, call the PNP (911) first. Then report it here: our admins and the renter are alerted right away." footer={<Button variant="danger" loading={report.isPending} disabled={incident.description.trim().length < 10} onClick={() => report.mutate()}>Send report</Button>}>
        <div className="space-y-4">
          <Select label="Type" value={incident.type} onChange={(e) => setIncident({ ...incident, type: e.target.value })} options={[{ value: 'damage', label: 'Damage' }, { value: 'theft', label: 'Vehicle not returned / stolen' }, { value: 'missing_parts', label: 'Missing parts (battery, tires, accessories)' }, { value: 'accident', label: 'Accident' }, { value: 'traffic_violation', label: 'Traffic violation' }, { value: 'other', label: 'Other' }]} />
          <Textarea label="What happened?" rows={4} value={incident.description} onChange={(e) => setIncident({ ...incident, description: e.target.value })} error={errors.description} />
          <Input label="Amount to claim" type="number" leftIcon={<span className="text-xs font-bold">₱</span>} value={incident.amount_claimed} onChange={(e) => setIncident({ ...incident, amount_claimed: e.target.value })} optional />
        </div>
      </Modal>
    </section>
  )
}
