import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { Eye, EyeOff, Lock, User } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, Input } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { destinationFor } from '@/lib/afterLogin'
import { getBlockInfo, getErrorMessage, getFieldErrors } from '@/lib/api'
import type { BlockInfo } from '@/types'
import { AuthCard, PillSubmit, softField } from './AuthCard'
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

  const subtitle = from?.startsWith('/checkout')
    ? 'Log in to finish your booking.'
    : intent === 'host'
      ? 'Log in to manage your vehicles, or apply to become a host.'
      : 'Log in to book rides and manage your trips.'

  // Renters, hosts and admins all sign in here (one users table with a role); destinationFor() sends each to the right place.
  return (
    <AuthCard title="Login" subtitle={subtitle}>
      {block && <BlockedNotice block={block} />}
      {error && <Alert tone="danger" className="mt-5">{error}</Alert>}
      <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
        <Input
          aria-label="Username or email"
          autoComplete="username"
          leftIcon={<User className="text-brand" />}
          value={form.login}
          onChange={(e) => setForm({ ...form, login: e.target.value })}
          error={errors.login}
          placeholder="Username or email"
          className={softField(errors.login)}
          required
        />
        <Input
          aria-label="Password"
          type={show ? 'text' : 'password'}
          autoComplete="current-password"
          leftIcon={<Lock className="text-brand" />}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          error={errors.password}
          placeholder="Password"
          className={softField(errors.password)}
          required
          rightSlot={
            <button type="button" onClick={() => setShow(!show)} className="rounded-lg p-1.5 text-ink-400 hover:text-ink-700" aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          }
        />
        <div className="-mt-2 text-right">
          <Link to="/forgot-password" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand hover:underline">Forgot password?</Link>
        </div>
        <PillSubmit loading={busy}>Login Now</PillSubmit>
      </form>
      <SocialButtons action="Login" />
      <p className="mt-7 text-center text-sm text-ink-500">
        New to ByaheGo?{' '}
        <Link to="/register" state={location.state} className="font-semibold text-brand hover:underline">Create an account</Link>
      </p>
    </AuthCard>
  )
}
