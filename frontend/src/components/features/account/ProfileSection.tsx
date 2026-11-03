import { useState, type FormEvent } from 'react'
import { BadgeCheck, Mail, MapPin, Phone, ShieldCheck, User } from 'lucide-react'
import { toast } from 'sonner'
import { PageTitle } from '@/components/common/SectionHeading'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Alert, Avatar, Button, Card, CardBody, CardHeader, Input, Switch } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { getErrorMessage, getFieldErrors } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { accountService } from '@/services/account'

export function ProfileSection() {
  const { user, setUser } = useAuth()
  const [form, setForm] = useState({ name: user?.name ?? '', email: user?.email ?? '', phone: user?.phone ?? '', city: user?.city ?? '' })
  const [prefs, setPrefs] = useState({ notify_email: user?.notify_email ?? true, notify_sms: user?.notify_sms ?? false })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  if (!user) return null

  const save = async (e?: FormEvent, override?: Partial<typeof prefs>) => {
    e?.preventDefault()
    setBusy(!override)
    setErrors({})
    try {
      const updated = await accountService.update({ ...form, ...prefs, ...override })
      setUser(updated)
      toast.success(override ? 'Preferences saved' : 'Profile updated')
    } catch (err) {
      setErrors(getFieldErrors(err))
      toast.error(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const v = user.verification_status
  return (
    <section className="space-y-5">
      <PageTitle title="Profile & settings" description="Manage your details, sign-in methods and preferences." />
      {v !== 'verified' && (
        <Alert
          tone={v === 'rejected' ? 'danger' : 'warning'}
          icon={<ShieldCheck />}
          title={v === 'pending' ? 'Your license is being reviewed' : v === 'rejected' ? 'Please upload your license again' : 'Verify your identity to start booking'}
          action={v !== 'pending' && <Button size="sm" to="/verify">Verify now</Button>}
        >
          {v === 'pending' ? 'Usually done within 24 hours. We\'ll notify you.' : 'Upload your driver\'s license and a selfie – it takes about 3 minutes.'}
        </Alert>
      )}
      <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader title="Personal info" description="Use the same name that's on your driver's license." />
          <CardBody>
            <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
              <Input label="Full name" leftIcon={<User />} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
              <Input label="Username" value={user.username} disabled hint="Your username can't be changed." />
              <Input label="Email" type="email" leftIcon={<Mail />} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} />
              <Input label="Mobile number" type="tel" leftIcon={<Phone />} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={errors.phone} />
              <Input label="City" leftIcon={<MapPin />} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} wrapperClassName="sm:col-span-2" placeholder="e.g. Lapu-Lapu City" />
              <div className="sm:col-span-2">
                <Button type="submit" loading={busy}>Save changes</Button>
              </div>
            </form>
          </CardBody>
        </Card>
        <Card className="overflow-hidden">
          <div className="bg-hero p-5 text-white">
            <Avatar initials={user.initials} size="lg" seed={user.id} />
            <p className="mt-3 text-lg font-bold">{user.name}</p>
            <p className="text-sm text-white/70">Member since {formatDate(user.joined_at, { month: 'long', year: 'numeric' })}</p>
          </div>
          <div className="space-y-3 p-5 text-sm">
            <div className="flex items-center justify-between"><span className="text-ink-500">Driver's license</span><StatusBadge status={v} /></div>
            <div className="flex items-center justify-between"><span className="text-ink-500">Account type</span><span className="font-semibold capitalize">{user.role === 'renter' ? 'Renter' : user.role}</span></div>
            {v === 'verified' && <p className="flex items-center gap-1.5 text-xs font-semibold text-success"><BadgeCheck className="size-4" /> You can book self-drive trips</p>}
          </div>
        </Card>
      </div>
      <Card>
        <CardHeader title="Preferences" description="How we keep you posted about trips, refunds and offers." />
        <CardBody className="space-y-4">
          {[
            { k: 'notify_email' as const, t: 'Email updates', s: 'Booking confirmations, receipts and refund updates' },
            { k: 'notify_sms' as const, t: 'Text messages', s: 'Pick-up reminders and urgent trip alerts' },
          ].map((p) => (
            <div key={p.k} className="flex items-center justify-between gap-4">
              <div><p className="text-sm font-semibold">{p.t}</p><p className="text-xs text-ink-500">{p.s}</p></div>
              <Switch checked={prefs[p.k]} label={p.t} onChange={(val) => { setPrefs({ ...prefs, [p.k]: val }); void save(undefined, { [p.k]: val }) }} />
            </div>
          ))}
        </CardBody>
      </Card>
    </section>
  )
}
