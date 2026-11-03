import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Eye, EyeOff, Lock, User } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, Button, Input } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { getErrorMessage } from '@/lib/api'
import { GoogleSignInButton } from './GoogleSignInButton'

export function LoginSection() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ login: '', password: '' })
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const from = (location.state as { from?: string } | null)?.from

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const user = await login(form.login.trim(), form.password)
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`)
      navigate(from ?? (user.role === 'admin' ? '/admin' : user.role === 'host' ? '/host' : '/'), { replace: true })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="w-full max-w-md animate-slide-up rounded-3xl bg-white p-6 shadow-pop sm:p-8">
      <h1 className="text-center text-2xl font-extrabold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-center text-sm text-ink-500">{from?.startsWith('/checkout') ? 'Log in to finish your booking.' : 'Log in to book rides and manage your trips.'}</p>
      {error && <Alert tone="danger" className="mt-5">{error}</Alert>}
      <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
        <Input label="Username or email" autoComplete="username" leftIcon={<User />} value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} placeholder="e.g. juan.delacruz or juan@email.com" required autoFocus />
        <Input
          label="Password"
          type={show ? 'text' : 'password'}
          autoComplete="current-password"
          leftIcon={<Lock />}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
          rightSlot={
            <button type="button" onClick={() => setShow(!show)} className="rounded-lg p-1.5 text-ink-400 hover:text-ink-700" aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          }
        />
        <Button type="submit" fullWidth size="lg" loading={busy} disabled={!form.login || !form.password}>
          Log in
        </Button>
      </form>
      <GoogleSignInButton text="signin_with" />
      <p className="mt-6 text-center text-sm text-ink-500">
        New to ByaheGo?{' '}
        <Link to="/register" state={location.state} className="font-semibold text-brand hover:underline">
          Create an account
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-ink-400">
        Forgot your password? <Link to="/help#contact" className="font-semibold text-ink-500 underline">Contact support</Link> and we'll help you get back in.
      </p>
    </section>
  )
}
