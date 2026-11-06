import { useQuery } from '@tanstack/react-query'
import { useLocation, useSearchParams } from 'react-router'
import { API_URL } from '@/lib/api'
import { rememberAfterLogin } from '@/lib/afterLogin'
import { authService } from '@/services/auth'

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

function FacebookLogo() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#fff" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.69.24 2.69.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.88v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
    </svg>
  )
}

/**
 * "Continue with Google / Facebook". Each button is a plain link to our API, which sends the person to the provider and
 * back. A button only shows when the server has that provider's keys.
 */
export function SocialButtons({ verb = 'Continue' }: { verb?: string }) {
  const location = useLocation()
  const [params] = useSearchParams()
  const { data } = useQuery({ queryKey: ['auth-config'], queryFn: authService.config, staleTime: 5 * 60_000 })
  if (!data || (!data.google_enabled && !data.facebook_enabled)) return null
  const remember = () => rememberAfterLogin({ from: (location.state as { from?: string } | null)?.from, intent: params.get('intent') === 'host' ? 'host' : undefined })
  const link = 'flex h-11 w-full items-center justify-center gap-3 rounded-full text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'
  return (
    <div>
      <div className="my-5 flex items-center gap-3 text-xs text-ink-400">
        <span className="h-px flex-1 bg-line-200" /> or <span className="h-px flex-1 bg-line-200" />
      </div>
      <div className="space-y-3">
        {data.google_enabled && (
          <a href={`${API_URL}/api/auth/google/redirect`} onClick={remember} className={`${link} border border-[#747775] bg-white text-[#1f1f1f] hover:bg-[#f8f9fa]`}>
            <GoogleLogo /> {verb} with Google
          </a>
        )}
        {data.facebook_enabled && (
          <a href={`${API_URL}/api/auth/facebook/redirect`} onClick={remember} className={`${link} bg-[#1877F2] text-white hover:bg-[#166fe5]`}>
            <FacebookLogo /> {verb} with Facebook
          </a>
        )}
      </div>
    </div>
  )
}
