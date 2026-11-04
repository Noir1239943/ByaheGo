import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { Eye, EyeOff, Lock, User } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, Button, Input } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { destinationFor } from '@/lib/afterLogin'
import { getBlockInfo, getErrorMessage, getFieldErrors } from '@/lib/api'
import type { BlockInfo } from '@/types'
import { BlockedNotice } from './BlockedNotice'
import { SocialButtons } from './SocialButtons'

export function LoginSection() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const [form, setForm] = useState({ login: '', password: '' })
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [block, setBlock] = useState<BlockInfo | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const from = (location.state as { from?: string } | null)?.from
  const intent = params.get('intent') === 'host' ? 'host' : undefined

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const local: Record<string, string> = {}
    if (!form.login.trim()) local.login = 'Enter your username or email.'
    if (!form.password) local.password = 'Enter your password.'
    setErrors(local)
    setError('')
    setBlock(null)
    if (Object.keys(local).length) return
    setBusy(true)
    try {
      const user = await login(form.login.trim(), form.password)
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`)
      navigate(destinationFor(user, { from, intent }), { replace: true })
    } catch (err) {
      const blocked = getBlockInfo(err)
      if (blocked) return setBlock(blocked)
      const fe = getFieldErrors(err)
      setErrors(fe)
      if (!Object.keys(fe).length) setError(getErrorMessage(err))
      else if (!fe.login && !fe.password) setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="w-full max-w-md animate-slide-up rounded-3xl bg-white p-6 shadow-pop sm:p-8">
      <h1 className="text-center text-2xl font-extrabold tracking-tight">{intent === 'host' ? 'Host sign in' : 'Welcome back'}</h1>
      <p className="mt-1 text-center text-sm text-ink-500">
        {intent === 'host' ? 'Log in to manage your vehicles, or apply to become a host.' : from?.startsWith('/checkout') ? 'Log in to finish your booking.' : 'Log in to book rides and manage your trips.'}
      </p>
      {block && <BlockedNotice block={block} />}
      {error && <Alert tone="danger" className="mt-5">{error}</Alert>}
      <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
        <Input label="Username or email" autoComplete="username" leftIcon={<User />} value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} error={errors.login} placeholder="juan.dc or juan@email.com" required />
        <Input
          label="Password"
          type={show ? 'text' : 'password'}
          autoComplete="current-password"
          leftIcon={<Lock />}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          error={errors.password}
          required
          rightSlot={
            <button type="button" onClick={() => setShow(!show)} className="rounded-lg p-1.5 text-ink-400 hover:text-ink-700" aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          }
        />
        <div className="-mt-1 text-right">
          <Link to="/forgot-password" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand hover:underline">Forgot password?</Link>
        </div>
        <Button type="submit" fullWidth size="lg" loading={busy}>Log in</Button>
      </form>
      <SocialButtons />
      <p className="mt-6 text-center text-sm text-ink-500">
        New to ByaheGo?{' '}
        <Link to="/register" state={location.state} className="font-semibold text-brand hover:underline">Create an account</Link>
      </p>
      {intent !== 'host' && (
        <p className="mt-2 text-center text-sm text-ink-500">
          Own a vehicle? <Link to="/login?intent=host" className="font-semibold text-brand hover:underline">Sign in to the host dashboard</Link>
        </p>
      )}
    </section>
  )
}
