import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { AtSign, Lock, Mail, Phone, User } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, Button, Checkbox, Input } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { getErrorMessage, getFieldErrors } from '@/lib/api'
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

  return (
    <section className="w-full max-w-lg animate-slide-up rounded-3xl bg-white p-6 shadow-pop sm:p-8">
      <h1 className="text-center text-2xl font-extrabold tracking-tight">Create your account</h1>
      <p className="mt-1 text-center text-sm text-ink-500">It's free. Book your first ride in minutes.</p>
      {error && <Alert tone="danger" className="mt-5">{error}</Alert>}
      <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2" noValidate>
        <Input label="Full name" hint="As it appears on your driver's license" autoComplete="name" leftIcon={<User />} value={form.name} onChange={set('name')} error={errors.name} wrapperClassName="sm:col-span-2" required />
        <Input label="Username" autoComplete="username" leftIcon={<AtSign />} value={form.username} onChange={set('username')} error={errors.username} placeholder="juan.dc" required />
        <Input label="Mobile number" type="tel" autoComplete="tel" leftIcon={<Phone />} value={form.phone} onChange={set('phone')} error={errors.phone} placeholder="0917 123 4567" />
        <Input label="Email" type="email" autoComplete="email" leftIcon={<Mail />} value={form.email} onChange={set('email')} error={errors.email} wrapperClassName="sm:col-span-2" required />
        <Input label="Password" type="password" autoComplete="new-password" leftIcon={<Lock />} value={form.password} onChange={set('password')} error={errors.password} hint="At least 8 characters with a number" required />
        <Input label="Confirm password" type="password" autoComplete="new-password" leftIcon={<Lock />} value={form.password_confirmation} onChange={set('password_confirmation')} error={errors.password_confirmation} required />
        <Checkbox
          className="sm:col-span-2"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          label={<>I agree to the <Link to="/terms" target="_blank" className="text-brand underline">Terms & Rental Agreement</Link> and <Link to="/privacy" target="_blank" className="text-brand underline">Privacy Policy</Link></>}
        />
        <Button type="submit" fullWidth size="lg" loading={busy} className="sm:col-span-2">
          Create account
        </Button>
      </form>
      <SocialButtons />
      <p className="mt-6 text-center text-sm text-ink-500">
        Already have an account?{' '}
        <Link to="/login" state={location.state} className="font-semibold text-brand hover:underline">
          Log in
        </Link>
      </p>
    </section>
  )
}
