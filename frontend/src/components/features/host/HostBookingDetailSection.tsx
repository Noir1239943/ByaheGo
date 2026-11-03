import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { AlertTriangle, ArrowLeft, BadgeCheck, CalendarDays, ClipboardCheck, KeyRound, MapPin, Phone, Undo2 } from 'lucide-react'
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
import { INSPECTION_ITEMS } from '@/lib/constants'
import { formatDate, formatDateTime, localToIso, peso, toLocalInput } from '@/lib/format'
import { hostService } from '@/services/host'

type InspectionForm = { odometer: string; fuel_level: string; checklist: Record<string, boolean>; notes: string; actual_return_at: string; damage_reported: boolean; damage_type: string; damage_description: string; damage_amount: string }

export function HostBookingDetailSection() {
  const { reference = '' } = useParams()
  const qc = useQueryClient()
  const { data: b, isLoading, error, refetch } = useQuery({ queryKey: ['host', 'booking', reference], queryFn: () => hostService.booking(reference) })
  const [modal, setModal] = useState<null | 'pickup' | 'return' | 'incident'>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const blank = (): InspectionForm => ({
    odometer: '', fuel_level: '100', checklist: Object.fromEntries(INSPECTION_ITEMS.map((i) => [i.key, true])), notes: '',
    actual_return_at: toLocalInput(new Date()), damage_reported: false, damage_type: 'damage', damage_description: '', damage_amount: '',
  })
  const [form, setForm] = useState<InspectionForm>(blank)
  const [incident, setIncident] = useState({ type: 'damage', description: '', amount_claimed: '' })

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
            {b.status === 'confirmed' && <Button icon={<KeyRound className="size-4" />} onClick={() => { setForm(blank()); setModal('pickup') }}>Start handover</Button>}
            {b.status === 'active' && <Button icon={<Undo2 className="size-4" />} onClick={() => { setForm(blank()); setModal('return') }}>Record return</Button>}
            {['active', 'completed'].includes(b.status) && <Button variant="secondary" icon={<AlertTriangle className="size-4" />} onClick={() => setModal('incident')}>Report incident</Button>}
          </div>
        </div>
        <div className="border-t border-line-100 bg-page/50 p-5 sm:p-6"><TripTimeline b={b} /></div>
      </Card>
      {s === 'overdue' && <Alert tone="danger" title="Return is overdue">Call the renter. Hourly late fees are added automatically when you record the return. If you can't reach them, report it as an incident.</Alert>}

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
            <CardHeader title="Condition records" description="Pick-up and return checklists" />
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

      <Modal open={modal === 'pickup'} onClose={() => setModal(null)} title="Start handover" description="Walk around the vehicle with the renter. Take photos of every side, then record what you see." size="lg" footer={<Button loading={pickup.isPending} disabled={!form.odometer} onClick={() => pickup.mutate()}>Confirm pick-up</Button>}>
        {inspectionFields('pickup')}
      </Modal>
      <Modal open={modal === 'return'} onClose={() => setModal(null)} title="Record return" description="Check the vehicle with the renter. Late fees are calculated automatically from the actual return time." size="lg" footer={<Button loading={ret.isPending} disabled={!form.odometer} onClick={() => ret.mutate()}>Confirm return</Button>}>
        {inspectionFields('return')}
      </Modal>
      <Modal open={modal === 'incident'} onClose={() => setModal(null)} title="Report an incident" description="For theft or an emergency, call the PNP (911) first, then our 24/7 line." footer={<Button variant="danger" loading={report.isPending} disabled={incident.description.trim().length < 10} onClick={() => report.mutate()}>Send report</Button>}>
        <div className="space-y-4">
          <Select label="Type" value={incident.type} onChange={(e) => setIncident({ ...incident, type: e.target.value })} options={[{ value: 'damage', label: 'Damage' }, { value: 'theft', label: 'Vehicle not returned / stolen' }, { value: 'missing_parts', label: 'Missing parts (battery, tires, accessories)' }, { value: 'accident', label: 'Accident' }, { value: 'traffic_violation', label: 'Traffic violation' }, { value: 'other', label: 'Other' }]} />
          <Textarea label="What happened?" rows={4} value={incident.description} onChange={(e) => setIncident({ ...incident, description: e.target.value })} error={errors.description} />
          <Input label="Amount to claim" type="number" leftIcon={<span className="text-xs font-bold">₱</span>} value={incident.amount_claimed} onChange={(e) => setIncident({ ...incident, amount_claimed: e.target.value })} optional />
        </div>
      </Modal>
    </section>
  )
}
