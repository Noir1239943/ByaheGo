import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { getErrorMessage } from '@/lib/api'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

type GoogleId = {
  initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string }) => void
  renderButton: (el: HTMLElement, o: Record<string, unknown>) => void
}
declare global {
  interface Window { google?: { accounts: { id: GoogleId } } }
}

let scriptPromise: Promise<void> | null = null
function loadScript() {
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Google script failed'))
    document.head.appendChild(s)
  })
  return scriptPromise
}

/** "Continue with Google" using Google Identity Services. Hidden until a client ID is configured. */
export function GoogleSignInButton({ text = 'continue_with' }: { text?: 'signin_with' | 'signup_with' | 'continue_with' }) {
  const ref = useRef<HTMLDivElement>(null)
  const { googleLogin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!CLIENT_ID) return
    let cancelled = false
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.google) return
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: async ({ credential }) => {
            try {
              const user = await googleLogin(credential)
              toast.success(`Welcome, ${user.name.split(' ')[0]}!`)
              const from = (location.state as { from?: string } | null)?.from
              navigate(from ?? '/', { replace: true })
            } catch (e) {
              toast.error(getErrorMessage(e))
            }
          },
        })
        window.google.accounts.id.renderButton(ref.current, { theme: 'outline', size: 'large', shape: 'pill', text, width: ref.current.offsetWidth || 320, logo_alignment: 'center' })
        setReady(true)
      })
      .catch(() => setReady(false))
    return () => {
      cancelled = true
    }
  }, [googleLogin, navigate, location.state, text])

  if (!CLIENT_ID) return null
  return (
    <div>
      <div className="my-5 flex items-center gap-3 text-xs text-ink-400">
        <span className="h-px flex-1 bg-line-200" /> or <span className="h-px flex-1 bg-line-200" />
      </div>
      <div ref={ref} className="flex min-h-11 w-full justify-center" aria-busy={!ready} />
    </div>
  )
}
