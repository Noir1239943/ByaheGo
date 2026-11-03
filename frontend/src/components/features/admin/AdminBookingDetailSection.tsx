import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { ArrowLeft, BadgeCheck, CalendarDays, Download, Mail, MapPin, MessageSquare, Phone, Receipt, RotateCcw, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { InfoRow, KeyValue } from '@/components/common/InfoRow'
import { ErrorState, PageLoader } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { tripStatus } from '@/lib/status'
import { VehicleImage } from '@/components/common/VehicleImage'
import { DepositCard } from '@/components/features/bookings/DepositCard'
import { IncidentsList } from '@/components/features/bookings/IncidentsList'
import { InspectionsList } from '@/components/features/bookings/InspectionsList'
import { PaymentsList } from '@/components/features/bookings/PaymentsList'
import { TripTimeline } from '@/components/features/bookings/TripTimeline'
import { Alert, Avatar, Badge, Button, Card, CardBody, CardHeader, Checkbox, Input, Modal, Select, Textarea } from '@/components/ui'
import { getErrorMessage } from '@/lib/api'
import { downloadFile } from '@/lib/download'
import { formatDate, formatDateTime, peso, timeAgo } from '@/lib/format'
import { adminService } from '@/services/admin'
import type { UserBrief } from '@/types'

function PersonCard({ title, u, extra }: { title: string; u: UserBrief | null; extra?: string }) {
  if (!u) return null
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between"><p className="text-xs font-bold tracking-wider text-ink-500 uppercase">{title}</p>{u.verification_status === 'verified' && <Badge tone="success"><BadgeCheck className="size-3" /> ID verified</Badge>}</div>
      <Link to={`/admin/users/${u.id}`} className="mt-3 flex items-center gap-3 hover:opacity-80">
        <Avatar initials={u.initials} seed={u.id} />
        <div><p className="font-bold">{u.name}</p><p className="text-xs text-ink-500">@{u.username}{extra ? ` · ${extra}` : ''}</p></div>
      </Link>
      <div className="mt-3 space-y-1.5 text-sm text-ink-700">
        {u.phone && <p className="flex items-center gap-2"><Phone className="size-4 text-ink-400" /> {u.phone}</p>}
        <p className="flex items-center gap-2"><Mail className="size-4 text-ink-400" /> {u.email}</p>
      </div>
    </Card>
  )
}

export function AdminBookingDetailSection() {
  const { reference = '' } = useParams()
  const qc = useQueryClient()
  const { data: b, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'booking', reference], queryFn: () => adminService.booking(reference) })
  const [modal, setModal] = useState<null | 'refund' | 'cancel' | 'message'>(null)
  const [refund, setRefund] = useState({ amount: '', reason: '' })
  const [cancel, setCancel] = useState({ reason: '', refund: true })
  const [msg, setMsg] = useState({ to: 'renter' as 'renter' | 'host', message: '' })
  const [note, setNote] = useState('')
  useEffect(() => setNote(b?.admin_note ?? ''), [b?.admin_note])

  const done = (m: string) => { toast.success(m); setModal(null); void qc.invalidateQueries({ queryKey: ['admin'] }) }
  const onErr = (e: unknown) => toast.error(getErrorMessage(e))
  const doRefund = useMutation({ mutationFn: () => adminService.refund(reference, Number(refund.amount), refund.reason), onSuccess: () => done('Refund sent to the renter'), onError: onErr })
  const doCancel = useMutation({ mutationFn: () => adminService.cancelBooking(reference, cancel.reason, cancel.refund), onSuccess: () => done('Booking cancelled'), onError: onErr })
  const doMsg = useMutation({ mutationFn: () => adminService.message(reference, msg.to, msg.message), onSuccess: () => { done('Message sent'); setMsg({ ...msg, message: '' }) }, onError: onErr })
  const doNote = useMutation({ mutationFn: () => adminService.note(reference, note), onSuccess: () => done('Note saved'), onError: onErr })

  if (isLoading) return <PageLoader />
  if (error || !b) return <ErrorState error={error} onRetry={() => void refetch()} />
  const v = b.vehicle

  return (
    <section className="space-y-5">
      <Link to="/admin/bookings" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"><ArrowLeft className="size-4" /> Bookings</Link>
      {b.admin_flag && <Alert tone="warning" title="This trip needs a decision">{b.admin_flag_note} Cancel it (the renter gets a full refund) or leave it as is.</Alert>}
      <Card>
        <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center">
          <div className="h-24 w-36 shrink-0 overflow-hidden rounded-2xl"><VehicleImage photo={v.photo} type={v.type} color={v.color_hex} alt={v.name} /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink-500">Booking {b.reference} · created {timeAgo(b.created_at)}</p>
            <h2 className="text-xl font-extrabold">{v.name}</h2>
            <div className="mt-2 flex flex-wrap gap-2"><StatusBadge status={tripStatus(b)} /><StatusBadge status={b.payment_status} /><Badge tone={b.deposit_status === 'on_hold' ? 'warning' : 'neutral'}>Deposit: {b.deposit_status.replace('_', ' ')}</Badge></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon={<MessageSquare className="size-4" />} onClick={() => setModal('message')}>Message</Button>
            <Button variant="secondary" size="sm" icon={<RotateCcw className="size-4" />} disabled={!b.refundable} onClick={() => setModal('refund')}>Issue refund</Button>
            <Button variant="secondary" size="sm" icon={<Receipt className="size-4" />} to={`/invoice/${b.reference}`}>Invoice</Button>
            {b.agreement.has_copy && <Button variant="secondary" size="sm" icon={<Download className="size-4" />} onClick={() => void downloadFile(`/admin/bookings/${b.reference}/agreement.pdf`, `ByaheGo-agreement-${b.reference}.pdf`).catch((e) => toast.error(getErrorMessage(e)))}>Agreement PDF</Button>}
            {['confirmed', 'active'].includes(b.status) && <Button variant="danger-outline" size="sm" icon={<XCircle className="size-4" />} onClick={() => setModal('cancel')}>Cancel booking</Button>}
          </div>
        </div>
        <div className="border-t border-line-100 bg-page/50 p-5"><TripTimeline b={b} /></div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Trip details" />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <InfoRow icon={<CalendarDays />} label="Pick-up" value={formatDateTime(b.pickup_at)} />
              <InfoRow icon={<CalendarDays />} label="Return" value={formatDateTime(b.return_at)} />
              <InfoRow icon={<MapPin />} label="Location" value={b.pickup_label} />
              <InfoRow icon={<BadgeCheck />} label="Protection · agreement" value={<>{b.protection.name}<span className="block text-xs font-normal text-ink-500">v{b.agreement.version} signed {formatDateTime(b.agreement.accepted_at)}{b.agreement.signer_name ? ` by ${b.agreement.signer_name}` : ''}</span></>} />
            </CardBody>
          </Card>
          <div className="grid gap-5 md:grid-cols-2">
            <PersonCard title="Renter" u={b.renter} extra={`Driver: ${b.driver.name}`} />
            <PersonCard title="Host" u={b.host} />
          </div>
          {b.incidents.length > 0 && <Card><CardHeader title="Incidents" action={<Button size="sm" variant="ghost" to="/admin/disputes">Open disputes</Button>} /><CardBody><IncidentsList incidents={b.incidents} /></CardBody></Card>}
          <Card><CardHeader title="Condition records" /><CardBody><InspectionsList inspections={b.inspections} /></CardBody></Card>
          <Card><CardHeader title="Payments & refunds" /><CardBody className="py-2"><PaymentsList payments={b.payments} /></CardBody></Card>
          <Card>
            <CardHeader title="Activity log" />
            <CardBody>
              <ol className="relative space-y-4 border-l border-line-200 pl-5">
                {b.events?.map((e, i) => (
                  <li key={i} className="relative">
                    <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full bg-brand" />
                    <p className="text-sm text-ink-900">{e.message}</p>
                    <p className="text-xs text-ink-500">{formatDateTime(e.created_at)} · {e.actor}</p>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>
        <aside className="space-y-5">
          <Card className="p-5">
            <p className="font-bold">Payment summary</p>
            <div className="mt-2 divide-y divide-line-100">
              <KeyValue label={`Rental · ${b.days} × ${peso(b.daily_rate)}`} value={peso(b.rental_subtotal)} />
              {b.driver_fee_total > 0 && <KeyValue label="Driver" value={peso(b.driver_fee_total)} />}
              <KeyValue label={b.protection.name} value={b.protection_total ? peso(b.protection_total) : 'Included'} />
              <KeyValue label="Service fee" value={peso(b.service_fee)} />
              <KeyValue label="Total" value={peso(b.total)} strong />
              <KeyValue label="Paid via" value={`${b.payment_method_label} ${b.payments[0]?.account_hint ?? ''}`} />
              <KeyValue label="Security deposit" value={peso(b.security_deposit)} />
              <KeyValue label="Still refundable" value={peso(b.refundable ?? 0)} />
            </div>
          </Card>
          <Card className="p-5">
            <p className="font-bold">Revenue split</p>
            <div className="mt-2 divide-y divide-line-100">
              <KeyValue label="Host earnings" value={peso(b.host_earnings)} />
              <KeyValue label={`Platform commission (${b.commission_rate}%)`} value={peso(b.commission ?? 0)} />
              <KeyValue label="Service fee" value={peso(b.service_fee)} />
              <KeyValue label="Payout" value={b.payout ? <StatusBadge status={b.payout.status} label={b.payout.status === 'paid' ? 'Paid' : `Scheduled ${formatDate(b.payout.scheduled_for, { month: 'short', day: 'numeric' })}`} /> : 'After return'} />
            </div>
          </Card>
          {b.status !== 'cancelled' && <DepositCard b={b} />}
          <Card className="p-5">
            <p className="font-bold">Admin notes</p>
            <Textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal note. Only admins can see this." wrapperClassName="mt-3" aria-label="Admin note" />
            <Button size="sm" variant="secondary" className="mt-3" loading={doNote.isPending} onClick={() => doNote.mutate()}>Save note</Button>
          </Card>
        </aside>
      </div>

      <Modal open={modal === 'refund'} onClose={() => setModal(null)} title="Issue a refund" description={`Up to ${peso(b.refundable ?? 0)} can still be refunded to ${b.payment_method_label}.`} size="sm" footer={<Button loading={doRefund.isPending} disabled={!refund.amount || refund.reason.length < 3} onClick={() => doRefund.mutate()}>Refund {refund.amount ? peso(Number(refund.amount)) : ''}</Button>}>
        <div className="space-y-4">
          <Input label="Amount" type="number" leftIcon={<span className="text-xs font-bold">₱</span>} value={refund.amount} onChange={(e) => setRefund({ ...refund, amount: e.target.value })} />
          <Textarea label="Reason (shared with the renter)" rows={2} value={refund.reason} onChange={(e) => setRefund({ ...refund, reason: e.target.value })} placeholder="e.g. Late handover by host" />
        </div>
      </Modal>
      <Modal open={modal === 'cancel'} onClose={() => setModal(null)} title="Cancel this booking?" size="sm" footer={<Button variant="danger" loading={doCancel.isPending} disabled={cancel.reason.length < 3} onClick={() => doCancel.mutate()}>Cancel booking</Button>}>
        <div className="space-y-4">
          <Textarea label="Reason" rows={2} value={cancel.reason} onChange={(e) => setCancel({ ...cancel, reason: e.target.value })} placeholder="e.g. Vehicle breakdown reported by host" />
          <Checkbox checked={cancel.refund} onChange={(e) => setCancel({ ...cancel, refund: e.target.checked })} label={`Refund everything still refundable (${peso(b.refundable ?? 0)})`} />
        </div>
      </Modal>
      <Modal open={modal === 'message'} onClose={() => setModal(null)} title="Send a message" description="It appears in their notifications with a link to this trip." size="sm" footer={<Button loading={doMsg.isPending} disabled={msg.message.length < 3} onClick={() => doMsg.mutate()}>Send</Button>}>
        <div className="space-y-4">
          <Select label="To" value={msg.to} onChange={(e) => setMsg({ ...msg, to: e.target.value as 'renter' })} options={[{ value: 'renter', label: `Renter – ${b.renter?.name}` }, { value: 'host', label: `Host – ${b.host?.name}` }]} />
          <Textarea label="Message" rows={4} value={msg.message} onChange={(e) => setMsg({ ...msg, message: e.target.value })} />
        </div>
      </Modal>
    </section>
  )
}
