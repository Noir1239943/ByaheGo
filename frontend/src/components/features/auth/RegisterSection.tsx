import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { AtSign, Lock, Mail, Phone, User } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, Checkbox, Input } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { getErrorMessage, getFieldErrors } from '@/lib/api'
import { AuthCard, PillSubmit, softField } from './AuthCard'
import { SocialButtons } from './SocialButtons'

export function RegisterSection() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ name: '', username: '', email: '', phone: '', password: '', password_confirmation: '' })
  const [agree, setAgree] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const from = (location.state as { from?: string } | null)?.from
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!agree) return setError('Please agree to the terms to create your account.')
    if (form.password !== form.password_confirmation) return setErrors({ password_confirmation: 'Passwords don\'t match.' })
    setBusy(true)
    setError('')
    setErrors({})
    try {
      const user = await register(form)
      toast.success(`Welcome to ByaheGo, ${user.name.split(' ')[0]}!`)
      navigate(from ?? '/verify', { replace: true, state: from ? undefined : { welcome: true } })
    } catch (err) {
      const fe = getFieldErrors(err)
      setErrors(fe)
      if (!Object.keys(fe).length) setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const icon = 'text-brand'
  return (
    <AuthCard wide title="Sign up" subtitle="It's free. Book your first ride in minutes.">
      {error && <Alert tone="danger" className="mt-5">{error}</Alert>}
      <form onSubmit={submit} className="mt-7 grid gap-4 sm:grid-cols-2" noValidate>
        <Input aria-label="Full name" placeholder="Full name" hint="As it appears on your driver's license" autoComplete="name" leftIcon={<User className={icon} />} value={form.name} onChange={set('name')} error={errors.name} className={softField(errors.name)} wrapperClassName="sm:col-span-2" required />
        <Input aria-label="Username" placeholder="Username" autoComplete="username" leftIcon={<AtSign className={icon} />} value={form.username} onChange={set('username')} error={errors.username} className={softField(errors.username)} required />
        <Input aria-label="Mobile number (optional)" placeholder="Mobile (optional)" type="tel" autoComplete="tel" leftIcon={<Phone className={icon} />} value={form.phone} onChange={set('phone')} error={errors.phone} className={softField(errors.phone)} />
        <Input aria-label="Email" placeholder="Email" type="email" autoComplete="email" leftIcon={<Mail className={icon} />} value={form.email} onChange={set('email')} error={errors.email} className={softField(errors.email)} wrapperClassName="sm:col-span-2" required />
        <Input aria-label="Password" placeholder="Password" type="password" autoComplete="new-password" leftIcon={<Lock className={icon} />} value={form.password} onChange={set('password')} error={errors.password} className={softField(errors.password)} hint="At least 8 characters with a number" required />
        <Input aria-label="Confirm password" placeholder="Confirm password" type="password" autoComplete="new-password" leftIcon={<Lock className={icon} />} value={form.password_confirmation} onChange={set('password_confirmation')} error={errors.password_confirmation} className={softField(errors.password_confirmation)} required />
        <Checkbox
          className="sm:col-span-2"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          label={<>I agree to the <Link to="/terms" target="_blank" className="text-brand underline">Terms & Rental Agreement</Link> and <Link to="/privacy" target="_blank" className="text-brand underline">Privacy Policy</Link></>}
        />
        <div className="sm:col-span-2">
          <PillSubmit loading={busy}>Sign Up Now</PillSubmit>
        </div>
      </form>
      <SocialButtons action="Sign up" />
      <p className="mt-7 text-center text-sm text-ink-500">
        Already have an account?{' '}
        <Link to="/login" state={location.state} className="font-semibold text-brand hover:underline">
          Log in
        </Link>
      </p>
    </AuthCard>
  )
}
