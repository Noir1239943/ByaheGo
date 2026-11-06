import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { CheckCircle2, Lock, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, Button, Input } from '@/components/ui'
import { getErrorMessage, getFieldErrors } from '@/lib/api'
import { authService } from '@/services/auth'

const card = 'w-full max-w-md animate-slide-up rounded-3xl bg-white p-6 shadow-pop sm:p-8'

/** Step 1: ask for the account email. The answer is always the same, so nobody can probe which emails exist. */
export function ForgotPasswordSection() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter the email you signed up with.')
    setBusy(true)
    setError('')
    try {
      await authService.forgotPassword(email.trim())
      setSent(true)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <section className={card}>
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success-soft"><CheckCircle2 className="size-7 text-success" /></span>
        <h1 className="mt-4 text-center text-2xl font-extrabold tracking-tight">Check your email</h1>
        <p className="mt-2 text-center text-sm text-ink-500">If an account exists for <b>{email}</b>, we've sent a link to reset your password. It expires in 60 minutes.</p>
        <Button to="/login" variant="secondary" fullWidth className="mt-6">Back to log in</Button>
      </section>
    )
  }
  return (
    <section className={card}>
      <h1 className="text-center text-2xl font-extrabold tracking-tight">Forgot your password?</h1>
      <p className="mt-1 text-center text-sm text-ink-500">Enter your email and we'll send you a link to choose a new one.</p>
      {error && <Alert tone="danger" className="mt-5">{error}</Alert>}
      <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
        <Input label="Email" type="email" autoComplete="email" leftIcon={<Mail />} value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Button type="submit" fullWidth size="lg" loading={busy}>Send reset link</Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-500"><Link to="/login" className="font-semibold text-brand hover:underline">Back to log in</Link></p>
    </section>
  )
}

/** Step 2: the page the emailed link opens. */
export function ResetPasswordSection() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''
  const email = params.get('email') ?? ''
  const [form, setForm] = useState({ password: '', password_confirmation: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  if (!token || !email) {
    return (
      <section className={card}>
        <Alert tone="danger" title="This reset link isn't valid">Open the link from your email again, or request a new one.</Alert>
        <Button to="/forgot-password" fullWidth className="mt-5">Request a new link</Button>
      </section>
    )
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const local: Record<string, string> = {}
    if (form.password.length < 8) local.password = 'Use at least 8 characters, with letters and numbers.'
    if (form.password !== form.password_confirmation) local.password_confirmation = "Passwords don't match."
    setErrors(local)
    if (Object.keys(local).length) return
    setBusy(true)
    try {
      await authService.resetPassword({ token, email, ...form })
      toast.success('Password updated. Log in with your new password.')
      navigate('/login', { replace: true })
    } catch (err) {
      const fe = getFieldErrors(err)
      setErrors(Object.keys(fe).length ? { ...fe, password: fe.password ?? fe.email ?? '' } : { password: getErrorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={card}>
      <h1 className="text-center text-2xl font-extrabold tracking-tight">Choose a new password</h1>
      <p className="mt-1 text-center text-sm text-ink-500">For {email}</p>
      <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
        <Input label="New password" type="password" autoComplete="new-password" leftIcon={<Lock />} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} error={errors.password} hint="At least 8 characters with letters and numbers" required />
        <Input label="Confirm new password" type="password" autoComplete="new-password" leftIcon={<Lock />} value={form.password_confirmation} onChange={(e) => setForm({ ...form, password_confirmation: e.target.value })} error={errors.password_confirmation} required />
        <Button type="submit" fullWidth size="lg" loading={busy}>Update password</Button>
      </form>
    </section>
  )
}
