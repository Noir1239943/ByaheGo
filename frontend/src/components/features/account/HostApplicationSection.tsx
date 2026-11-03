import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock, LayoutDashboard, Store, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { PageTitle } from '@/components/common/SectionHeading'
import { PageLoader } from '@/components/common/States'
import { Alert, Button, Card, CardBody, CardHeader, Checkbox, Chip, Input, Select, Textarea } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { getErrorMessage, getFieldErrors } from '@/lib/api'
import { PAYOUT_LABELS, VEHICLE_TYPES } from '@/lib/constants'
import { formatDate } from '@/lib/format'
import { accountService } from '@/services/account'

export function HostApplicationSection() {
  const { user, refresh } = useAuth()
  const qc = useQueryClient()
  const { data: app, isLoading } = useQuery({ queryKey: ['host-application'], queryFn: accountService.hostApplication })
  const [retry, setRetry] = useState(false)
  const [form, setForm] = useState({
    full_name: user?.name ?? '', phone: user?.phone ?? '', city: user?.city ?? '', address: '', vehicle_count: '1', vehicle_types: [] as string[],
    business_name: '', payout_method: 'gcash', payout_account_name: user?.name ?? '', payout_account_number: '', notes: '',
  })
  const [agree, setAgree] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const submit = useMutation({
    mutationFn: () => accountService.applyHost({ ...form, vehicle_count: Number(form.vehicle_count), agree_terms: agree }),
    onSuccess: () => { toast.success('Application sent! We\'ll review it within 1–2 business days.'); setRetry(false); void qc.invalidateQueries({ queryKey: ['host-application'] }); void refresh() },
    onError: (e) => { setErrors(getFieldErrors(e)); toast.error(getErrorMessage(e)) },
  })

  if (isLoading) return <PageLoader />
  if (user?.role === 'host' || user?.role === 'admin') {
    return (
      <section>
        <PageTitle title="Hosting" />
        <Card className="p-8 text-center">
          <CheckCircle2 className="mx-auto size-12 text-success" />
          <h2 className="mt-3 text-xl font-bold">You're a ByaheGo host</h2>
          <p className="mt-1 text-ink-500">Manage your vehicles, bookings and earnings from your dashboard.</p>
          <Button className="mt-5" icon={<LayoutDashboard className="size-4" />} to={user.role === 'admin' ? '/admin' : '/host'}>Open dashboard</Button>
        </Card>
      </section>
    )
  }
  if (app && !retry && app.status !== 'approved') {
    const pending = app.status === 'pending'
    return (
      <section>
        <PageTitle title="Your host application" />
        <Card className="p-8 text-center">
          {pending ? <Clock className="mx-auto size-12 text-warning" /> : <XCircle className="mx-auto size-12 text-danger" />}
          <h2 className="mt-3 text-xl font-bold">{pending ? 'We\'re reviewing your application' : 'Your application needs changes'}</h2>
          <p className="mx-auto mt-1 max-w-md text-ink-500">{pending ? `Submitted ${formatDate(app.submitted_at)}. Our team checks every host to keep ByaheGo safe – this usually takes 1–2 business days.` : app.admin_notes}</p>
          <div className="mx-auto mt-5 max-w-sm rounded-2xl bg-page p-4 text-left text-sm">
            <p><span className="text-ink-500">Vehicles:</span> <b>{app.vehicle_count}</b> ({app.vehicle_types.join(', ')})</p>
            <p><span className="text-ink-500">City:</span> <b>{app.city}</b></p>
            <p><span className="text-ink-500">Payouts to:</span> <b>{PAYOUT_LABELS[app.payout_method]} {app.payout_account_masked}</b></p>
          </div>
          {!pending && <Button className="mt-5" onClick={() => setRetry(true)}>Apply again</Button>}
        </Card>
      </section>
    )
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value })
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!agree) return setErrors({ agree_terms: 'Please accept the host terms.' })
    submit.mutate()
  }
  return (
    <section>
      <PageTitle title="Become a host" description="Tell us about you and your vehicles. Once approved, you can list them and start earning." />
      <Alert tone="brand" icon={<Store />} className="mb-5" title="How hosting works">
        Apply → our team reviews you (1–2 days) → list your vehicle with photos and OR/CR → we approve the listing → renters book and you get paid 3 days after each trip.
      </Alert>
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <Card>
          <CardHeader title="About you" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Input label="Full name" value={form.full_name} onChange={f('full_name')} error={errors.full_name} />
            <Input label="Mobile number" value={form.phone} onChange={f('phone')} error={errors.phone} placeholder="0917 123 4567" />
            <Input label="City" value={form.city} onChange={f('city')} error={errors.city} placeholder="e.g. Cordova" />
            <Input label="Business name" value={form.business_name} onChange={f('business_name')} optional />
            <Input label="Address" value={form.address} onChange={f('address')} wrapperClassName="sm:col-span-2" optional />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Your vehicles" />
          <CardBody className="space-y-4">
            <Input label="How many vehicles will you list?" type="number" min={1} value={form.vehicle_count} onChange={f('vehicle_count')} error={errors.vehicle_count} wrapperClassName="max-w-xs" />
            <div>
              <p className="mb-2 text-sm font-medium text-ink-700">Vehicle types</p>
              <div className="flex flex-wrap gap-2">
                {VEHICLE_TYPES.map((t) => (
                  <Chip key={t.value} showCheck active={form.vehicle_types.includes(t.value)} onClick={() => setForm({ ...form, vehicle_types: form.vehicle_types.includes(t.value) ? form.vehicle_types.filter((x) => x !== t.value) : [...form.vehicle_types, t.value] })}>{t.label}</Chip>
                ))}
              </div>
              {errors.vehicle_types && <p className="mt-1 text-xs font-medium text-danger">{errors.vehicle_types}</p>}
            </div>
            <Textarea label="Anything else we should know?" rows={3} value={form.notes} onChange={f('notes')} optional placeholder="e.g. I have a 2021 Vios I only use on weekends." />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Where should we send your earnings?" description="Payouts are sent 3 days after each completed trip." />
          <CardBody className="grid gap-4 sm:grid-cols-3">
            <Select label="Payout method" value={form.payout_method} onChange={f('payout_method')} options={[{ value: 'gcash', label: 'GCash' }, { value: 'maya', label: 'Maya' }, { value: 'bank', label: 'Bank transfer' }]} />
            <Input label="Account name" value={form.payout_account_name} onChange={f('payout_account_name')} error={errors.payout_account_name} />
            <Input label={form.payout_method === 'bank' ? 'Account number' : 'Mobile number'} value={form.payout_account_number} onChange={f('payout_account_number')} error={errors.payout_account_number} />
          </CardBody>
        </Card>
        <Checkbox checked={agree} onChange={(e) => setAgree(e.target.checked)} error={errors.agree_terms} label="I own these vehicles (or have the owner's permission), their registration is up to date, and I agree to the host terms." />
        <Button type="submit" size="lg" loading={submit.isPending}>Submit application</Button>
      </form>
    </section>
  )
}
