import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router'
import { AlertTriangle, ArrowLeft, CalendarPlus, Car, FileText, Headset, KeyRound, MapPin, Receipt, ShieldCheck, Star, User } from 'lucide-react'
import { toast } from 'sonner'
import { InfoRow } from '@/components/common/InfoRow'
import { PriceBreakdown } from '@/components/common/PriceBreakdown'
import { RentalAgreement } from '@/components/common/RentalAgreement'
import { ErrorState, PageLoader } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { tripStatus } from '@/lib/status'
import { VehicleImage } from '@/components/common/VehicleImage'
import { PaymentFields, PaymentMethodPicker } from '@/components/features/checkout/CheckoutSection'
import { DepositCard } from '@/components/features/bookings/DepositCard'
import { IncidentsList } from '@/components/features/bookings/IncidentsList'
import { InspectionsList } from '@/components/features/bookings/InspectionsList'
import { PaymentsList } from '@/components/features/bookings/PaymentsList'
import { TripTimeline } from '@/components/features/bookings/TripTimeline'
import { Alert, Button, Card, CardBody, CardHeader, Modal, Select, Textarea } from '@/components/ui'
import { getErrorMessage, getFieldErrors } from '@/lib/api'
import { downloadIcs } from '@/lib/calendar'
import { cn } from '@/lib/cn'
import { formatDateTime, peso, timeUntil } from '@/lib/format'
import { bookingService } from '@/services/bookings'
import type { PaymentMethod } from '@/types'

export function TripDetailSection() {
  const { reference = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const qc = useQueryClient()
  const { data: b, isLoading, error, refetch } = useQuery({ queryKey: ['booking', reference], queryFn: () => bookingService.get(reference) })
  const [modal, setModal] = useState<null | 'cancel' | 'review' | 'pay' | 'report' | 'agreement'>(null)
  const [reason, setReason] = useState('')
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('gcash')
  const [pay, setPay] = useState<Record<string, string>>({})
  const [payErrors, setPayErrors] = useState<Record<string, string>>({})
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
  const cancel = useMutation({ mutationFn: () => bookingService.cancel(reference, reason), onSuccess: () => done('Trip cancelled. Your full refund is on its way.'), onError: (e) => toast.error(getErrorMessage(e)) })
  const review = useMutation({ mutationFn: () => bookingService.review(reference, { rating, comment }), onSuccess: () => done('Thanks for your review!'), onError: (e) => toast.error(getErrorMessage(e)) })
  const payBalance = useMutation({
    mutationFn: () => bookingService.payBalance(reference, { payment_method: method, ...pay }),
    onSuccess: () => done('Payment received. You\'re all settled!'),
    onError: (e) => { setPayErrors(getFieldErrors(e)); toast.error(getErrorMessage(e)) },
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

      {s === 'overdue' && <Alert tone="danger" title="Your return is overdue">Please return the vehicle as soon as possible. Hourly late fees apply after the 60-minute grace period. Call support if you need help.</Alert>}
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
            <CardBody><InspectionsList inspections={b.inspections} /></CardBody>
          </Card>

          {b.incidents.length > 0 && (
            <Card>
              <CardHeader title="Reports & claims" />
              <CardBody><IncidentsList incidents={b.incidents} /></CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Payments & refunds" description="Every charge and refund for this trip, with official receipt numbers." action={<Button size="sm" variant="ghost" to={`/invoice/${b.reference}`}>View receipt</Button>} />
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
                  <p className="text-xs text-ink-500">Free cancellation until {formatDateTime(b.free_cancellation_until)}.</p>
                </>
              ) : (
                <p className="rounded-xl bg-page p-3 text-xs text-ink-700">Free cancellation ended {formatDateTime(b.free_cancellation_until)} (a day before pick-up). Need to change plans? Contact support.</p>
              )
            )}
            {['active', 'completed'].includes(b.status) && (
              <Button variant="secondary" fullWidth icon={<AlertTriangle className="size-4" />} onClick={() => setModal('report')}>Report a problem</Button>
            )}
            <Button variant="secondary" fullWidth icon={<FileText className="size-4" />} onClick={() => setModal('agreement')}>Rental agreement</Button>
            <Button variant="ghost" fullWidth icon={<Headset className="size-4" />} to="/help#contact">Contact support</Button>
            <Button variant="ghost" fullWidth icon={<Car className="size-4" />} to={`/vehicles/${v.id}`}>View vehicle</Button>
          </Card>
        </aside>
      </div>

      <Modal
        open={modal === 'cancel'}
        onClose={() => setModal(null)}
        title="Cancel this trip?"
        description="You're cancelling more than a day before pick-up, so it's free."
        size="sm"
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Keep my trip</Button><Button variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate()}>Cancel and refund</Button></>}
      >
        <div className="rounded-2xl bg-success-soft p-4 text-sm">
          <p className="font-semibold">You'll get back {peso(b.amount_paid)}</p>
          <p className="mt-0.5 text-ink-700">Trip total {peso(b.total)} + deposit {peso(b.security_deposit)}, refunded to {b.payment_method_label}. It usually arrives within 3–5 banking days.</p>
        </div>
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

      <Modal open={modal === 'pay'} onClose={() => setModal(null)} title={`Pay ${peso(b.balance_due)} balance`} footer={<Button loading={payBalance.isPending} onClick={() => payBalance.mutate()}>Pay {peso(b.balance_due)}</Button>}>
        <PaymentMethodPicker value={method} onChange={setMethod} />
        <div className="mt-4"><PaymentFields method={method} values={pay} setValue={(k, val) => setPay({ ...pay, [k]: val })} errors={payErrors} /></div>
      </Modal>

      <Modal open={modal === 'report'} onClose={() => setModal(null)} title="Report a problem" description="For emergencies, call our 24/7 line: (032) 888 2924." footer={<Button loading={reportIt.isPending} disabled={report.description.trim().length < 10} onClick={() => reportIt.mutate()}>Send report</Button>}>
        <div className="space-y-4">
          <Select label="What happened?" value={report.type} onChange={(e) => setReport({ ...report, type: e.target.value })} options={[{ value: 'breakdown', label: 'The vehicle broke down' }, { value: 'accident', label: 'I was in an accident' }, { value: 'damage', label: 'I found damage' }, { value: 'other', label: 'Something else' }]} />
          <Textarea label="Tell us more" rows={4} value={report.description} onChange={(e) => setReport({ ...report, description: e.target.value })} placeholder="Where are you and what happened? Are you safe?" />
        </div>
      </Modal>

      <Modal open={modal === 'agreement'} onClose={() => setModal(null)} title="Rental agreement" description={b.agreement.accepted_at ? `You accepted version ${b.agreement.version} on ${formatDateTime(b.agreement.accepted_at)}.` : undefined} size="lg">
        <RentalAgreement deposit={b.security_deposit} />
      </Modal>
    </section>
  )
}
