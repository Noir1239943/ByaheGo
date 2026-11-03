import axios, { AxiosError } from 'axios'

export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')
const TOKEN_KEY = 'byahego_token'

export const tokenStore = {
  get: () => {
    try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
  },
  set: (t: string) => {
    try { localStorage.setItem(TOKEN_KEY, t) } catch { /* storage unavailable */ }
  },
  clear: () => {
    try { localStorage.removeItem(TOKEN_KEY) } catch { /* storage unavailable */ }
  },
}

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { Accept: 'application/json' },
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ code?: string }>) => {
    const status = error.response?.status
    const code = error.response?.data?.code
    if (status === 401 || code === 'account_blocked') {
      if (tokenStore.get()) {
        tokenStore.clear()
        window.dispatchEvent(new CustomEvent('byahego:signed-out', { detail: { code } }))
      }
    }
    return Promise.reject(error)
  },
)

type ApiErrorBody = { message?: string; errors?: Record<string, string[]> }

/** A friendly, customer-facing message for any failed request. */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    if (!error.response) return 'We can\'t reach ByaheGo right now. Check your internet connection and try again.'
    const data = error.response.data
    const first = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined
    if (first) return first
    if (data?.message && error.response.status < 500) return data.message
    if (error.response.status === 429) return 'You\'re going a little fast. Please wait a moment and try again.'
    return fallback
  }
  return fallback
}

/** Field-level validation errors from Laravel (422), keyed by field name. */
export function getFieldErrors(error: unknown): Record<string, string> {
  if (axios.isAxiosError<ApiErrorBody>(error) && error.response?.status === 422 && error.response.data?.errors) {
    return Object.fromEntries(Object.entries(error.response.data.errors).map(([k, v]) => [k, v[0]]))
  }
  return {}
}

export function mediaUrl(id: number | null | undefined) {
  return id ? `${API_URL}/api/media/${id}` : null
}

/** If a request failed because the account is suspended or revoked, the details to show (reason, end date, how to appeal). */
export function getBlockInfo(error: unknown): import('@/types').BlockInfo | null {
  if (axios.isAxiosError<{ code?: string; block?: import('@/types').BlockInfo }>(error) && error.response?.status === 403 && error.response.data?.code === 'account_blocked') {
    return error.response.data.block ?? null
  }
  return null
}
