import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Mail } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, Button, Input } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { destinationFor, takeAfterLogin } from '@/lib/afterLogin'
import { getBlockInfo, getErrorMessage, getFieldErrors } from '@/lib/api'
import { authService } from '@/services/auth'
import type { BlockInfo, User } from '@/types'
import { BlockedNotice } from './BlockedNotice'

const ERRORS: Record<string, string> = {
  cancelled: 'Sign-in was cancelled. You can try again or use your username and password.',
  invalid_state: 'That sign-in attempt expired or looked unsafe. Please try again.',
  provider_error: "We couldn't reach the sign-in provider. Please try again in a moment.",
  not_configured: "That sign-in option isn't set up yet. Please use your username and password.",
  email_in_use: "An account with that email already exists, and the provider hasn't confirmed the address is yours. Log in with your username and password instead.",
}

/** Where Google / Facebook sign-in lands. Trades the one-time code for our token, so a token never appears in a URL. */
export function AuthCallbackSection() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { socialSession } = useAuth()
  const code = params.get('code')
  const errorCode = params.get('error')
  const needEmail = params.get('need_email') === '1'
  const [error, setError] = useState(errorCode ? (ERRORS[errorCode] ?? 'We could not sign you in. Please try again.') : '')
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [busy, setBusy] = useState(false)
  const [block, setBlock] = useState<BlockInfo | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (!code || needEmail || started.current) return
    started.current = true
    authService
      .exchangeSocialCode(code)
      .then(async (res) => {
        const user: User = await socialSession(res)
        toast.success(`Welcome, ${user.name.split(' ')[0]}!`)
        navigate(destinationFor(user, takeAfterLogin()), { replace: true })
      })
      .catch((e) => {
        const blocked = getBlockInfo(e)
        if (blocked) setBlock(blocked)
        else setError(getErrorMessage(e, 'That sign-in link has expired. Please try again.'))
      })
  }, [code, needEmail, socialSession, navigate])

  const submitEmail = async (e: FormEvent) => {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setEmailError('Enter a valid email address.')
    setBusy(true)
    setEmailError('')
    try {
      const user = await socialSession(await authService.completeSocial(code ?? '', email.trim()))
      toast.success(`Welcome, ${user.name.split(' ')[0]}!`)
      navigate(destinationFor(user, takeAfterLogin()), { replace: true })
    } catch (err) {
      setEmailError(getFieldErrors(err).email ?? getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const card = 'w-full max-w-md animate-slide-up rounded-3xl bg-white p-6 shadow-pop sm:p-8'
  if (block) {
    return (
      <section className={card}>
        <BlockedNotice block={block} />
        <Button to="/login" fullWidth variant="secondary" className="mt-5">Back to log in</Button>
      </section>
    )
  }
  if (error) {
    return (
      <section className={card}>
        <Alert tone="danger" title="We couldn't sign you in">{error}</Alert>
        <Button to="/login" fullWidth className="mt-5">Back to log in</Button>
      </section>
    )
  }
  if (needEmail && code) {
    return (
      <section className={card}>
        <h1 className="text-center text-2xl font-extrabold tracking-tight">One more thing</h1>
        <p className="mt-1 text-center text-sm text-ink-500">Facebook didn't share an email address. Add one so we can send you booking updates and receipts.</p>
        <form onSubmit={submitEmail} className="mt-5 space-y-4" noValidate>
          <Input label="Email" type="email" autoComplete="email" leftIcon={<Mail />} value={email} onChange={(e) => setEmail(e.target.value)} error={emailError} required />
          <Button type="submit" fullWidth size="lg" loading={busy}>Finish sign-up</Button>
        </form>
      </section>
    )
  }
  return (
    <section className={card}>
      <p className="text-center text-sm text-ink-500">Signing you in…</p>
    </section>
  )
}
