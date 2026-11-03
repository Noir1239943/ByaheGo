import { useState, type FormEvent } from 'react'
import { KeyRound, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { Badge, Button, Card, CardBody, CardHeader, Input } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { getErrorMessage, getFieldErrors } from '@/lib/api'
import { accountService } from '@/services/account'

export function SecuritySection() {
  const { user, refresh } = useAuth()
  const [form, setForm] = useState({ current_password: '', password: '', password_confirmation: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  if (!user) return null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      await accountService.password(user.has_password ? form : { password: form.password, password_confirmation: form.password_confirmation })
      setForm({ current_password: '', password: '', password_confirmation: '' })
      await refresh()
      toast.success('Password updated. Other devices were signed out.')
    } catch (err) {
      setErrors(getFieldErrors(err))
      toast.error(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-5 grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="Sign-in methods" />
        <CardBody className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-line-200 p-3">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-brand-tint text-brand"><KeyRound className="size-4" /></span>
              <div><p className="text-sm font-semibold">Username & password</p><p className="text-xs text-ink-500">@{user.username}</p></div>
            </div>
            <Badge tone={user.has_password ? 'success' : 'neutral'}>{user.has_password ? 'On' : 'Not set'}</Badge>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-line-200 p-3">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-white text-lg font-bold shadow-sm">G</span>
              <div><p className="text-sm font-semibold">Google</p><p className="text-xs text-ink-500">{user.google_linked ? user.email : 'Sign in with Google using the same email'}</p></div>
            </div>
            <Badge tone={user.google_linked ? 'success' : 'neutral'}>{user.google_linked ? 'Connected' : 'Not connected'}</Badge>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-line-200 p-3">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-[#1877F2] text-lg font-bold text-white shadow-sm">f</span>
              <div><p className="text-sm font-semibold">Facebook</p><p className="text-xs text-ink-500">{user.facebook_linked ? 'Signed in with Facebook' : 'Sign in with Facebook using the same email'}</p></div>
            </div>
            <Badge tone={user.facebook_linked ? 'success' : 'neutral'}>{user.facebook_linked ? 'Connected' : 'Not connected'}</Badge>
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={user.has_password ? 'Change password' : 'Set a password'} description="Use at least 8 characters with letters and a number." />
        <CardBody>
          <form onSubmit={submit} className="space-y-3">
            {user.has_password && <Input label="Current password" type="password" autoComplete="current-password" leftIcon={<Lock />} value={form.current_password} onChange={(e) => setForm({ ...form, current_password: e.target.value })} error={errors.current_password} />}
            <Input label="New password" type="password" autoComplete="new-password" leftIcon={<Lock />} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} error={errors.password} />
            <Input label="Confirm new password" type="password" autoComplete="new-password" leftIcon={<Lock />} value={form.password_confirmation} onChange={(e) => setForm({ ...form, password_confirmation: e.target.value })} error={errors.password_confirmation} />
            <Button type="submit" loading={busy} disabled={!form.password}>Update password</Button>
          </form>
        </CardBody>
      </Card>
    </section>
  )
}
