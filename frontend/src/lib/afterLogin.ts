import type { User } from '@/types'

const KEY = 'byahego_after_login'

export type AfterLogin = { from?: string; intent?: 'host' }

/** Remember where to go once sign-in finishes (it survives the trip to Google / Facebook). */
export function rememberAfterLogin(v: AfterLogin) {
  try { sessionStorage.setItem(KEY, JSON.stringify(v)) } catch { /* storage unavailable */ }
}

export function takeAfterLogin(): AfterLogin {
  try {
    const raw = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    return raw ? (JSON.parse(raw) as AfterLogin) : {}
  } catch {
    return {}
  }
}

/** Approved hosts go to the host dashboard; everyone else who chose "host" goes to the host application. */
export function destinationFor(user: User, after: AfterLogin): string {
  if (after.intent === 'host') return user.role === 'host' || user.role === 'admin' ? '/host' : '/account/host-application'
  return after.from ?? (user.role === 'admin' ? '/admin' : user.role === 'host' ? '/host' : '/')
}
