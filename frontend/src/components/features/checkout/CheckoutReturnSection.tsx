import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Clock, RefreshCw, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { ErrorState, PageLoader } from '@/components/common/States'
import { Button, Card } from '@/components/ui'
import { getErrorMessage } from '@/lib/api'
import { formatDateTime, peso } from '@/lib/format'
import { bookingService } from '@/services/bookings'
import type { Booking } from '@/types'

const POLL_MS = 3000
const GIVE_UP_AFTER_MS = 2 * 60_000

/**
 * Where Xendit sends the renter back to. The booking is NOT confirmed here: we ask the server, which asks Xendit
 * whether the payment really went through (the same check the webhook makes). So it also works on localhost, where
 * Xendit can't call us. While Xendit is still working we keep asking every few seconds.
 */
export function CheckoutReturnSection() {
  const { reference = '' } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const cameBack = params.get('cancelled') === '1'
  const [booking, setBooking] = useState<Booking | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [gaveUp, setGaveUp] = useState(false)
  const startedAt = useRef(Date.now())

  const check = useMutation({ mutationFn: () => bookingService.verifyPayment(reference), onSuccess: (b) => { setBooking(b); setError(null) }, onError: setError })
  const { mutate: verify, isPending } = check

  // Ask now, and again every few seconds while the booking is still waiting on the payment.
  useEffect(() => {
    verify()
  }, [verify])
  useEffect(() => {
    if (!booking || booking.status !== 'pending' || gaveUp) return
    const t = setTimeout(() => {
      if (Date.now() - startedAt.current > GIVE_UP_AFTER_MS) return setGaveUp(true)
      verify()
    }, POLL_MS)
    return () => clearTimeout(t)
  }, [booking, gaveUp, verify])

  useEffect(() => {
    if (booking && ['confirmed', 'active', 'completed'].includes(booking.status)) {
      void qc.invalidateQueries({ queryKey: ['trips'] })
      void qc.invalidateQueries({ queryKey: ['billing'] })
      navigate(`/booking/${booking.reference}/confirmed`, { replace: true })
    }
  }, [booking, navigate, qc])

  const tryAgain = useMutation({
    mutationFn: () => bookingService.pay(reference),
    onSuccess: (r) => {
      if (r.checkout_url) window.location.assign(r.checkout_url)
      else { setBooking(r.booking); toast.info(r.booking.status === 'cancelled' ? 'This booking has expired. You can book again any time.' : 'Your payment was already received.') }
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const drop = useMutation({
    mutationFn: () => bookingService.cancel(reference, 'Changed my mind before paying'),
    onSuccess: (b) => { setBooking(b); toast.success('Booking cancelled. Nothing was charged.') },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  if (error && !booking) return <div className="container-page py-10"><ErrorState error={error} onRetry={() => verify()} title="We couldn't check your payment" /></div>
  if (!booking) return <PageLoader label="Checking your payment…" />

  if (['confirmed', 'active', 'completed'].includes(booking.status)) return <PageLoader label="Payment received. Opening your booking…" />

  const cancelled = booking.status === 'cancelled'
  return (
    <section className="container-page max-w-xl py-10 text-center">
      {cancelled ? (
        <>
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-danger-soft"><XCircle className="size-8 text-danger" /></span>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight">This booking wasn't completed</h1>
          <p className="mt-2 text-ink-500">{booking.cancel_reason ?? 'The payment was not completed in time.'} Nothing was charged. If money was taken a moment ago, it is refunded automatically.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button to={`/vehicles/${booking.vehicle.id}`}>Book again</Button>
            <Button variant="ghost" to="/account/trips">My trips</Button>
          </div>
        </>
      ) : (
        <>
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-accent-soft"><Clock className={isPending ? 'size-8 animate-pulse text-warning' : 'size-8 text-warning'} /></span>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight">{cameBack ? 'You left the payment page' : gaveUp ? 'Still waiting for your payment' : 'Confirming your payment…'}</h1>
          <p className="mt-2 text-ink-500">
            {cameBack
              ? 'Your car is held for you while you decide. Nothing has been charged yet.'
              : gaveUp
                ? 'We haven\'t heard back from the payment provider yet. If you already paid, give it a minute and check again. Your money is safe.'
                : 'This usually takes a few seconds. Please keep this page open.'}
          </p>
          <Card className="mt-6 p-5 text-left">
            <p className="text-sm text-ink-500">Booking {booking.reference}</p>
            <p className="font-bold">{booking.vehicle.name}</p>
            <p className="mt-1 text-sm text-ink-500">{formatDateTime(booking.pickup_at)} → {formatDateTime(booking.return_at)}</p>
            <p className="mt-3 flex justify-between border-t border-line-100 pt-3 font-bold"><span>To pay</span><span>{peso(booking.total + booking.security_deposit)}</span></p>
            {booking.pay_by && <p className="mt-1 text-xs text-ink-500">We hold the dates until {formatDateTime(booking.pay_by)}.</p>}
          </Card>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button icon={<RefreshCw className="size-4" />} variant={cameBack ? 'secondary' : 'primary'} loading={isPending} onClick={() => { startedAt.current = Date.now(); setGaveUp(false); verify() }}>Check again</Button>
            <Button variant={cameBack ? 'primary' : 'secondary'} loading={tryAgain.isPending} onClick={() => tryAgain.mutate()}>Go back to payment</Button>
            <Button variant="ghost" loading={drop.isPending} onClick={() => drop.mutate()}>Cancel this booking</Button>
          </div>
          <p className="mt-6 text-xs text-ink-400">Need help? <Link to="/help#contact" className="font-semibold text-brand hover:underline">Contact support</Link></p>
        </>
      )}
    </section>
  )
}
