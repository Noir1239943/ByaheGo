import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { CalendarPlus, Check, CheckCircle2, MapPin, Receipt, User } from 'lucide-react'
import { InfoRow } from '@/components/common/InfoRow'
import { RatingInline } from '@/components/common/RatingStars'
import { ErrorState, PageLoader } from '@/components/common/States'
import { VehicleImage } from '@/components/common/VehicleImage'
import { Badge, Button, Card } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { formatDateTime, peso } from '@/lib/format'
import { downloadIcs } from '@/lib/calendar'
import { bookingService } from '@/services/bookings'

export function BookingConfirmedSection() {
  const { reference = '' } = useParams()
  const { user } = useAuth()
  const { data: b, isLoading, error } = useQuery({ queryKey: ['booking', reference], queryFn: () => bookingService.get(reference) })
  if (isLoading) return <PageLoader />
  if (error || !b) return <div className="container-page py-10"><ErrorState error={error} /></div>
  const charge = b.payments.find((p) => p.type === 'charge')
  return (
    <section className="container-page max-w-2xl py-10 text-center">
      <span className="mx-auto flex size-16 animate-slide-up items-center justify-center rounded-full bg-success-soft">
        <CheckCircle2 className="size-8 text-success" />
      </span>
      <h1 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">You're all set, {user?.name.split(' ')[0]}!</h1>
      <p className="mt-2 text-ink-500">Your {b.vehicle.make} {b.vehicle.model} is booked. We've sent the details to {b.driver.email}.</p>
      <span className="mt-3 inline-block rounded-full bg-white px-4 py-1.5 text-sm shadow-sm">Booking ref <b>{b.reference}</b></span>

      <Card className="mt-8 p-5 text-left sm:p-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-24 shrink-0 overflow-hidden rounded-xl"><VehicleImage photo={b.vehicle.photo} type={b.vehicle.type} color={b.vehicle.color_hex} alt={b.vehicle.name} /></div>
          <div className="min-w-0 flex-1">
            <p className="font-bold">{b.vehicle.name}</p>
            <RatingInline value={b.vehicle.rating_avg} count={b.vehicle.rating_count} />
          </div>
          <Badge tone="success" dot>Confirmed</Badge>
        </div>
        <div className="mt-5 grid gap-4 border-t border-line-100 pt-5 sm:grid-cols-2">
          <InfoRow icon={<CalendarPlus />} label="Pick-up" value={formatDateTime(b.pickup_at)} />
          <InfoRow icon={<CalendarPlus />} label="Return" value={formatDateTime(b.return_at)} />
          <InfoRow icon={<MapPin />} label="Location" value={b.pickup_label} />
          <InfoRow icon={<User />} label="Host" value={b.host?.name} />
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-line-100 pt-4">
          <span className="font-bold">Total paid</span>
          <span className="text-xl font-extrabold">{peso(b.amount_paid)}</span>
        </div>
        <p className="mt-1 flex justify-between text-sm text-ink-500">
          <span>Includes {peso(b.security_deposit)} refundable deposit</span>
          <span>{b.payment_method_label} {charge?.account_hint && `· ${charge.account_hint}`}</span>
        </p>
      </Card>

      <Card className="mt-4 p-5 text-left sm:p-6">
        <h2 className="font-bold">Before your trip</h2>
        <ul className="mt-3 space-y-2.5 text-sm text-ink-700">
          {[
            'Bring your driver\'s license and one valid government ID.',
            `Meet ${b.host?.name.split(' ')[0] ?? 'your host'} at ${b.pickup_label} about ten minutes early.`,
            'Walk around the vehicle together and take photos before you drive off.',
            `Free cancellation until ${formatDateTime(b.free_cancellation_until)}.`,
          ].map((t) => (
            <li key={t} className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={3} /> {t}</li>
          ))}
        </ul>
      </Card>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button to={`/account/trips/${b.reference}`}>View my booking</Button>
        <Button variant="secondary" icon={<Receipt className="size-4" />} to={`/invoice/${b.reference}`}>Receipt</Button>
        <Button variant="secondary" icon={<CalendarPlus className="size-4" />} onClick={() => downloadIcs(b)}>Add to calendar</Button>
        <Button variant="ghost" to="/">Back to home</Button>
      </div>
    </section>
  )
}
