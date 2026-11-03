import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Headset, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { ErrorState, ListSkeleton } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Alert, Badge, Button, Card, CardBody, CardHeader, EmptyState, Input, Modal, Tabs, Textarea } from '@/components/ui'
import { getErrorMessage, getFieldErrors } from '@/lib/api'
import { capitalize, timeAgo } from '@/lib/format'
import { adminService } from '@/services/admin'
import type { SupportTicket } from '@/types'

export function AdminSupportSection() {
  const [status, setStatus] = useState('open')
  const [active, setActive] = useState<SupportTicket | null>(null)
  const [reply, setReply] = useState('')
  const qc = useQueryClient()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'support', status], queryFn: () => adminService.support({ status }) })
  const send = useMutation({ mutationFn: () => adminService.replySupport(active!.id, reply), onSuccess: () => { toast.success('Reply sent and ticket closed'); setActive(null); setReply(''); void qc.invalidateQueries({ queryKey: ['admin'] }) }, onError: (e) => toast.error(getErrorMessage(e)) })
  return (
    <section>
      <Tabs className="mb-4" variant="pill" value={status} onChange={setStatus} tabs={[{ value: 'open', label: 'Open' }, { value: 'closed', label: 'Closed' }, { value: 'all', label: 'All' }]} />
      {isLoading ? <ListSkeleton /> : error ? <ErrorState error={error} onRetry={() => void refetch()} /> : data!.data.length === 0 ? (
        <Card><EmptyState icon={<Headset />} title="Inbox zero" description="Customer messages from the Help center show up here." /></Card>
      ) : (
        <div className="space-y-3">
          {data!.data.map((t) => (
            <Card key={t.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{t.name} <span className="font-normal text-ink-500">· {t.email}</span></p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-500"><Badge tone="info">{capitalize(t.topic)}</Badge>{t.booking_reference && <Link to={`/admin/bookings/${t.booking_reference}`} className="font-semibold text-brand">{t.booking_reference}</Link>}<span>{timeAgo(t.created_at)}</span></div>
                </div>
                <div className="flex items-center gap-2"><StatusBadge status={t.status} />{t.status === 'open' && <Button size="sm" onClick={() => setActive(t)}>Reply</Button>}</div>
              </div>
              <p className="mt-3 text-sm text-ink-700">{t.message}</p>
              {t.reply && <p className="mt-3 rounded-xl bg-brand-tint p-3 text-sm text-ink-700"><b>Our reply:</b> {t.reply}</p>}
            </Card>
          ))}
        </div>
      )}
      <Modal open={!!active} onClose={() => setActive(null)} title={`Reply to ${active?.name}`} description={active?.email} footer={<><Button variant="secondary" icon={<Mail className="size-4" />} onClick={() => (window.location.href = `mailto:${active?.email}?subject=Re: your ByaheGo message`)}>Open email app</Button><Button loading={send.isPending} disabled={reply.trim().length < 3} onClick={() => send.mutate()}>Send & close</Button></>}>
        <p className="mb-3 rounded-xl bg-page p-3 text-sm text-ink-700">{active?.message}</p>
        <Textarea label="Your reply" rows={5} value={reply} onChange={(e) => setReply(e.target.value)} />
      </Modal>
    </section>
  )
}

export function AdminSettingsSection() {
  const qc = useQueryClient()
  const { data, isLoading, error } = useQuery({ queryKey: ['admin', 'settings'], queryFn: adminService.settings })
  const [values, setValues] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  useEffect(() => { if (data) setValues(Object.fromEntries(Object.entries(data.values).map(([k, v]) => [k, String(v)]))) }, [data])
  const save = useMutation({
    mutationFn: () => adminService.updateSettings(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v)]))),
    onSuccess: () => { toast.success('Settings saved. New bookings use these values.'); setErrors({}); void qc.invalidateQueries({ queryKey: ['admin', 'settings'] }) },
    onError: (e) => { setErrors(getFieldErrors(e)); toast.error(getErrorMessage(e)) },
  })
  if (isLoading) return <ListSkeleton />
  if (error || !data) return <ErrorState error={error} />
  return (
    <section className="max-w-3xl space-y-5">
      <Alert tone="warning">Changes apply to new bookings only. Existing trips keep the fees they were booked with.</Alert>
      <Card>
        <CardHeader title="Fees & policies" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          {Object.entries(data.labels).map(([k, label]) => (
            <Input key={k} label={label} type="number" step="0.5" value={values[k] ?? ''} onChange={(e) => setValues({ ...values, [k]: e.target.value })} error={errors[k]} />
          ))}
        </CardBody>
      </Card>
      <Button loading={save.isPending} onClick={() => save.mutate()}>Save settings</Button>
    </section>
  )
}
