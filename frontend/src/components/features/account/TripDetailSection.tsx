import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router'
import { AlertTriangle, ArrowLeft, CalendarPlus, Camera, Car, Clock, Download, FileText, Headset, KeyRound, MapPin, Receipt, ShieldCheck, Star, User } from 'lucide-react'
import { toast } from 'sonner'
import { InfoRow } from '@/components/common/InfoRow'
import { PriceBreakdown } from '@/components/common/PriceBreakdown'
import { AgreementView } from '@/components/common/AgreementView'
import { ErrorState, PageLoader } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { tripStatus } from '@/lib/status'
import { VehicleImage } from '@/components/common/VehicleImage'
import { PaymentMethodPicker } from '@/components/features/checkout/CheckoutSection'
import { DepositCard } from '@/components/features/bookings/DepositCard'
import { IncidentsList } from '@/components/features/bookings/IncidentsList'
import { InspectionsList } from '@/components/features/bookings/InspectionsList'
import { PaymentsList } from '@/components/features/bookings/PaymentsList'
import { TripTimeline } from '@/components/features/bookings/TripTimeline'
import { Alert, Button, Card, CardBody, CardHeader, Input, Modal, Select, Textarea } from '@/components/ui'
import { TripPhotos } from '@/components/features/trip/TripPhotos'
import { getErrorMessage, getFieldErrors } from '@/lib/api'
import { parseAgreementText } from '@/lib/agreement'
import { downloadIcs } from '@/lib/calendar'
import { downloadFile } from '@/lib/download'
import { cn } from '@/lib/cn'
import { formatDateTime, localToIso, peso, timeUntil, toLocalInput } from '@/lib/format'
import { bookingService } from '@/services/bookings'
import { tripService } from '@/services/trip'
import type { PaymentMethod } from '@/types'

export function TripDetailSection() {
  const { reference = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const qc = useQueryClient()
  const { data: b, isLoading, error, refetch } = useQuery({ queryKey: ['booking', reference], queryFn: () => bookingService.get(reference) })
  const [modal, setModal] = useState<null | 'cancel' | 'review' | 'pay' | 'report' | 'agreement' | 'extend'>(null)
  const [extend, setExtend] = useState({ return_at: '', note: '' })
  const [extendErrors, setExtendErrors] = useState<Record<string, string>>({})
  const [reason, setReason] = useState('')
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('gcash')
  const [report, setReport] = useState({ type: 'breakdown', description: '' })

  useEffect(() => {
    if (params.get('review') && b?.can_review) {
      setModal('review')
      setParams({}, { replace: true })
    }
  }, [params, b, setParams])

  const done = (msg: string) => {
    toast.success(msg)
    setModal(null)
    void qc.invalidateQueries({ queryKey: ['booking', reference] })
    void qc.invalidateQueries({ queryKey: ['trips'] })
  }
  const cancel = useMutation({ mutationFn: () => bookingService.cancel(reference, reason), onSuccess: (r) => done(r.payment_status === 'unpaid' ? 'Booking cancelled. Nothing was charged.' : 'Trip cancelled. Your full refund is on its way.'), onError: (e) => toast.error(getErrorMessage(e)) })
  const review = useMutation({ mutationFn: () => bookingService.review(reference, { rating, comment }), onSuccess: () => done('Thanks for your review!'), onError: (e) => toast.error(getErrorMessage(e)) })
  // The balance, like the trip itself, is paid on Xendit's page. The booking page picks the result up when the renter comes back.
  const payBalance = useMutation({
    mutationFn: () => bookingService.payBalance(reference, method),
    onSuccess: (r) => window.location.assign(r.checkout_url),
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  // Finish paying an unpaid booking: back to the payment page (or a fresh one if it ran out).
  const resume = useMutation({
    mutationFn: () => bookingService.pay(reference),
    onSuccess: (r) => (r.checkout_url ? window.location.assign(r.checkout_url) : done(r.booking.status === 'cancelled' ? 'This booking expired because it wasn\'t paid in time.' : 'Your payment was received.')),
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const requestMore = useMutation({
    mutationFn: () => tripService.requestExtension(reference, { return_at: localToIso(extend.return_at), note: extend.note || undefined }),
    onSuccess: () => { setExtendErrors({}); done('Request sent. Your host will approve or decline it.') },
    onError: (e) => { setExtendErrors(getFieldErrors(e)); toast.error(getErrorMessage(e)) },
  })
  const reportIt = useMutation({ mutationFn: () => bookingService.reportIncident(reference, report), onSuccess: () => done('Report sent. Our team will contact you shortly.'), onError: (e) => toast.error(getErrorMessage(e)) })

  if (isLoading) return <PageLoader />
  if (error || !b) return <ErrorState error={error} onRetry={() => void refetch()} title="We couldn't find this trip" />

  const s = tripStatus(b)
  const v = b.vehicle

  return (
    <section className="space-y-5">
      <Link to="/account/trips" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"><ArrowLeft className="size-4" /> My trips</Link>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
          <div className="h-32 overflow-hidden rounded-2xl sm:h-28 sm:w-44 sm:shrink-0">
            <VehicleImage photo={v.photo} type={v.type} color={v.color_hex} alt={v.name} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><StatusBadge status={s} /><span className="text-sm text-ink-500">Booking {b.reference}</span></div>
            <h1 className="mt-1 text-2xl font-extrabold">{v.name}</h1>
            <p className="text-sm text-ink-500">{b.rental_type === 'driver' ? 'With professional driver' : 'Self-drive'} · {b.days} day{b.days > 1 ? 's' : ''} · Hosted by {b.host?.name}</p>
            {b.display_status === 'upcoming' && <p className="mt-1 text-sm font-semibold text-info">Pick-up in {timeUntil(b.pickup_at)}</p>}
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-col">
            <Button variant="secondary" size="sm" icon={<Receipt className="size-4" />} to={`/invoice/${b.reference}`}>Invoice & receipt</Button>
            {b.status !== 'cancelled' && b.status !== 'completed' && <Button variant="secondary" size="sm" icon={<CalendarPlus className="size-4" />} onClick={() => downloadIcs(b)}>Add to calendar</Button>}
          </div>
        </div>
        <div className="border-t border-line-100 bg-page/50 p-5 sm:p-6"><TripTimeline b={b} /></div>
      </Card>

      {b.status === 'pending' && (
        <Alert tone="warning" title="Finish paying to confirm this booking" action={<div className="flex gap-2"><Button size="sm" loading={resume.isPending} onClick={() => resume.mutate()}>Complete payment</Button><Button size="sm" variant="ghost" onClick={() => setModal('cancel')}>Cancel</Button></div>}>
          We're holding the dates for you{b.pay_by ? ` until ${formatDateTime(b.pay_by)}` : ''}. Nothing is charged until you pay, and the host is only told once the payment goes through.
        </Alert>
      )}
      {b.status === 'confirmed' && b.trip.can_checkin && (
        <Alert tone="brand" icon={<Camera />} title="Take your check-in photos" action={<Button size="sm" to={`/trips/${b.reference}/inspect/checkin`}>Start check-in</Button>}>
          Photograph the car and the dashboard before you drive off: 10 quick photos with your phone's camera. They protect you from being blamed for damage that was already there. Your host can't hand over the keys until this is done.
        </Alert>
      )}
      {b.status === 'confirmed' && !b.trip.checkin && !b.trip.can_checkin && b.trip.checkin_opens_at && (
        <Alert tone="info" icon={<Camera />} title="Check-in photos">Check-in opens {formatDateTime(b.trip.checkin_opens_at)}, 12 hours before pick-up.</Alert>
      )}
      {b.status === 'confirmed' && b.trip.checkin && <Alert tone="success" title="Check-in submitted">Your host has been told. Bring your license and meet at the pick-up spot.</Alert>}
      {b.status === 'active' && b.trip.can_checkout && (
        <Alert tone={b.trip.late.is_overdue ? 'danger' : 'brand'} icon={<Camera />} title={b.trip.late.is_overdue ? `Return overdue by ${b.trip.overdue_hours} hour(s)` : 'Ready to return the car?'} action={<Button size="sm" to={`/trips/${b.reference}/inspect/checkout`}>Take return photos</Button>}>
          {b.trip.late.is_overdue
            ? `Late fee so far: ${peso(b.trip.late.fee)}. It is counted when you submit the return photos and taken from your deposit.`
            : 'Take the same 10 photos again and enter the odometer and fuel. Returning after the return time costs ' + peso(b.trip.late.per_hour) + ' per hour once the ' + b.trip.late.grace_minutes + '-minute grace period is over.'}
        </Alert>
      )}
      {b.status === 'active' && b.trip.checkout_submitted_at && <Alert tone="info" title="Return photos submitted">Waiting for your host to review them{b.trip.host_review_due_at ? ` (by ${formatDateTime(b.trip.host_review_due_at)}, or the trip completes automatically)` : ''}.{b.trip.late.fee > 0 ? ` Excess fee: ${peso(b.trip.late.fee)} for ${b.trip.late.hours} hour(s), taken from your deposit.` : ''}</Alert>}
      {b.trip.extension?.status === 'pending' && <Alert tone="info" title="Waiting for your host">You asked to return on {formatDateTime(b.trip.extension.requested_return_at)}. Until your host answers, the original return time still applies.</Alert>}
      {b.trip.extension?.status === 'approved' && b.status === 'active' && <Alert tone="success" title="Extension approved">New return time: {formatDateTime(b.return_at)}. No late fee until then.</Alert>}
      {s === 'overdue' && <Alert tone="danger" title="Your return is overdue">Please return the vehicle as soon as possible. Excess-hour fees apply after the grace period. Take the return photos in the app, or call support if you need help.</Alert>}
      {b.balance_due > 0 && (
        <Alert tone="danger" title={`${peso(b.balance_due)} balance due`} action={<Button size="sm" onClick={() => setModal('pay')}>Pay now</Button>}>
          Trip charges were more than your deposit. Settle the balance to keep booking with ByaheGo.
        </Alert>
      )}
      {b.can_review && (
        <Alert tone="brand" icon={<Star />} title="How was your trip?" action={<Button size="sm" variant="accent" onClick={() => setModal('review')}>Leave a review</Button>}>
          Your review helps other renters and rewards great hosts.
        </Alert>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Trip details" />
            <CardBody className="grid gap-5 sm:grid-cols-2">
              <InfoRow icon={<CalendarPlus />} label="Pick-up" value={formatDateTime(b.pickup_at)} />
              <InfoRow icon={<CalendarPlus />} label="Return" value={formatDateTime(b.return_at)} />
              <InfoRow icon={<MapPin />} label="Pick-up location" value={<>{b.pickup_label}{b.pickup_lat && <a className="ml-1 text-xs font-semibold text-brand" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${b.pickup_lat},${b.pickup_lng}`}>Directions</a>}</>} />
              <InfoRow icon={<User />} label={b.rental_type === 'driver' ? 'Contact person' : 'Driver'} value={<>{b.driver.name}<span className="block text-xs font-normal text-ink-500">{b.driver.phone}</span></>} />
              <InfoRow icon={<ShieldCheck />} label="Protection" value={<>{b.protection.name}<span className="block text-xs font-normal text-ink-500">You pay at most {peso(b.protection.liability_cap)} for accidental damage</span></>} />
              <InfoRow icon={<KeyRound />} label="Host" value={b.host?.name} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Vehicle condition" description="Recorded together with your host – this protects you from being charged for old damage." />
            <CardBody className="space-y-4"><TripPhotos trip={b.trip} /><InspectionsList inspections={b.inspections} /></CardBody>
          </Card>

          {b.incidents.length > 0 && (
            <Card>
              <CardHeader title="Reports & claims" />
              <CardBody><IncidentsList incidents={b.incidents} /></CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Payments & refunds" description="Every charge and refund for this trip, with invoice numbers you can download." action={<Button size="sm" variant="ghost" to={`/invoice/${b.reference}`}>View receipt</Button>} />
            <CardBody className="py-2"><PaymentsList payments={b.payments} /></CardBody>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card className="p-5">
            <p className="mb-3 font-bold">Price breakdown</p>
            <PriceBreakdown q={{ ...b, protection_name: b.protection.name }} />
          </Card>
          {b.status !== 'cancelled' && <DepositCard b={b} />}

          <Card className="space-y-3 p-5">
            <p className="font-bold">Manage trip</p>
            {b.status === 'confirmed' && (
              b.can_cancel ? (
                <>
                  <Button variant="danger-outline" fullWidth onClick={() => setModal('cancel')}>Cancel trip</Button>
                  <p className="text-xs font-semibold text-success">Free cancellation until {formatDateTime(b.free_cancellation_until)}.</p>
                </>
              ) : (
                <div className="space-y-2 rounded-xl bg-page p-3 text-xs text-ink-700">
                  <p><b>Free cancellation ended</b> on {formatDateTime(b.free_cancellation_until)}, one day before pick-up, so the Cancel button is switched off.</p>
                  <p>You can still <Link to="/help#contact" className="font-semibold text-brand hover:underline">contact support</Link>, and once your trip starts you can report a problem here.</p>
                </div>
              )
            )}
            {['active', 'completed'].includes(b.status) && (
              <Button variant="secondary" fullWidth icon={<AlertTriangle className="size-4" />} onClick={() => setModal('report')}>Report a problem</Button>
            )}
            {b.trip.can_request_extension && <Button variant="secondary" fullWidth icon={<Clock className="size-4" />} onClick={() => { setExtend({ return_at: toLocalInput(new Date(new Date(b.return_at).getTime() + 24 * 3600_000)), note: '' }); setModal('extend') }}>Need more time?</Button>}
            {b.status !== 'cancelled' && <p className="rounded-xl bg-page p-3 text-xs text-ink-700"><b>Late return:</b> {peso(b.trip.late.per_hour)} per hour after a {b.trip.late.grace_minutes}-minute grace period. {b.trip.late.full_day_after_hours}+ hours late counts as one extra full day. Ask your host for more time before the return time to avoid it.</p>}
            <Button variant="secondary" fullWidth icon={<FileText className="size-4" />} onClick={() => setModal('agreement')}>Rental agreement</Button>
            <Button variant="ghost" fullWidth icon={<Headset className="size-4" />} to="/help#contact">Contact support</Button>
            <Button variant="ghost" fullWidth icon={<Car className="size-4" />} to={`/vehicles/${v.id}`}>View vehicle</Button>
          </Card>
        </aside>
      </div>

      <Modal
        open={modal === 'cancel'}
        onClose={() => setModal(null)}
        title={b.status === 'pending' ? 'Cancel this booking?' : 'Cancel this trip?'}
        description={b.status === 'pending' ? "You haven't paid yet, so nothing is charged and there is nothing to refund." : b.cancellation_fee_if_cancelled > 0 ? `A cancellation fee of ${peso(b.cancellation_fee_if_cancelled)} is kept from your refund.` : "You're cancelling more than a day before pick-up, so it's free."}
        size="sm"
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Keep my trip</Button><Button variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate()}>{b.status === 'pending' ? 'Cancel booking' : 'Cancel and refund'}</Button></>}
      >
        {b.status !== 'pending' && <div className="rounded-2xl bg-success-soft p-4 text-sm">
          <p className="font-semibold">You'll get back {peso(b.amount_paid - b.cancellation_fee_if_cancelled)}</p>
          <p className="mt-0.5 text-ink-700">Trip total {peso(b.total)} + deposit {peso(b.security_deposit)}{b.cancellation_fee_if_cancelled > 0 ? ` − cancellation fee ${peso(b.cancellation_fee_if_cancelled)}` : ''}, refunded to {b.payment_method_label}. It usually arrives within 3–5 banking days.</p>
        </div>}
        <Textarea label="Reason (optional)" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. My plans changed" wrapperClassName="mt-4" />
      </Modal>

      <Modal open={modal === 'review'} onClose={() => setModal(null)} title={`Rate your trip in the ${v.make} ${v.model}`} size="sm" footer={<Button loading={review.isPending} onClick={() => review.mutate()}>Submit review</Button>}>
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`}>
              <Star className={cn('size-9 transition', n <= rating ? 'fill-accent text-accent' : 'text-line-200')} />
            </button>
          ))}
        </div>
        <p className="mt-2 text-center text-sm font-semibold">{['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'][rating]}</p>
        <Textarea label="Tell others about it" rows={4} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Was the car clean? Was pick-up easy?" wrapperClassName="mt-4" />
      </Modal>

      <Modal open={modal === 'pay'} onClose={() => setModal(null)} title={`Pay ${peso(b.balance_due)} balance`} description="You'll finish on Xendit's secure payment page." footer={<Button loading={payBalance.isPending} onClick={() => payBalance.mutate()}>Continue to payment</Button>}>
        <PaymentMethodPicker value={method} onChange={setMethod} />
      </Modal>

      <Modal open={modal === 'extend'} onClose={() => setModal(null)} title="Ask to return later" description="Your host decides. If they approve, the return time changes and no late fee applies until the new time." size="sm" footer={<Button loading={requestMore.isPending} disabled={!extend.return_at} onClick={() => requestMore.mutate()}>Send request</Button>}>
        <div className="space-y-4">
          <p className="text-sm text-ink-500">Current return time: <b>{formatDateTime(b.return_at)}</b></p>
          <Input label="New return time" type="datetime-local" value={extend.return_at} onChange={(e) => setExtend({ ...extend, return_at: e.target.value })} error={extendErrors.return_at} />
          <Textarea label="Message to your host (optional)" rows={2} value={extend.note} onChange={(e) => setExtend({ ...extend, note: e.target.value })} />
        </div>
      </Modal>

      <Modal open={modal === 'report'} onClose={() => setModal(null)} title="Report a problem" description="For emergencies, call our 24/7 line: (032) 888 2924." footer={<Button loading={reportIt.isPending} disabled={report.description.trim().length < 10} onClick={() => reportIt.mutate()}>Send report</Button>}>
        <div className="space-y-4">
          <Select label="What happened?" value={report.type} onChange={(e) => setReport({ ...report, type: e.target.value })} options={[{ value: 'breakdown', label: 'The vehicle broke down' }, { value: 'accident', label: 'I was in an accident' }, { value: 'damage', label: 'I found damage' }, { value: 'stolen', label: 'The car was stolen while I was renting' }, { value: 'other', label: 'Something else' }]} />
          <Textarea label="Tell us more" rows={4} value={report.description} onChange={(e) => setReport({ ...report, description: e.target.value })} placeholder="Where are you and what happened? Are you safe?" />
        </div>
      </Modal>

      <Modal
        open={modal === 'agreement'}
        onClose={() => setModal(null)}
        title="Rental agreement"
        description={b.agreement.has_copy ? `Signed by ${b.agreement.signer_name} on ${formatDateTime(b.agreement.accepted_at)} · version ${b.agreement.version}` : undefined}
        size="lg"
        footer={b.agreement.has_copy ? <Button icon={<Download className="size-4" />} onClick={() => void downloadFile(`/bookings/${b.reference}/agreement.pdf`, `ByaheGo-agreement-${b.reference}.pdf`).catch((e) => toast.error(getErrorMessage(e)))}>Download PDF</Button> : undefined}
      >
        {b.agreement.text ? (
          <>
            <AgreementView sections={parseAgreementText(b.agreement.text)} />
            <p className="mt-4 break-all rounded-xl bg-page p-3 text-[11px] text-ink-500">Document hash (SHA-256): {b.agreement.hash}</p>
          </>
        ) : <p className="text-sm text-ink-500">There is no signed copy for this older booking. Contact support if you need one.</p>}
      </Modal>
    </section>
  )
}
