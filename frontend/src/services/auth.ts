import { api } from '@/lib/api'
import type { User } from '@/types'

type AuthResponse = { token: string; user: User }

export const authService = {
  login: (login: string, password: string) => api.post<AuthResponse>('/auth/login', { login, password }).then((r) => r.data),
  register: (data: { name: string; username: string; email: string; phone?: string; password: string; password_confirmation: string }) =>
    api.post<AuthResponse>('/auth/register', data).then((r) => r.data),
  /** Swap the one-time code from the Google / Facebook redirect for our API token. */
  exchangeSocialCode: (code: string) => api.post<AuthResponse>('/auth/social/exchange', { code }).then((r) => r.data),
  /** Finish a social sign-up where the provider gave no email. */
  completeSocial: (code: string, email: string) => api.post<AuthResponse>('/auth/social/complete', { code, email }).then((r) => r.data),
  config: () => api.get<{ google_enabled: boolean; facebook_enabled: boolean }>('/auth/config').then((r) => r.data),
  forgotPassword: (email: string) => api.post<{ message: string }>('/auth/forgot-password', { email }).then((r) => r.data),
  resetPassword: (data: { token: string; email: string; password: string; password_confirmation: string }) => api.post<{ message: string }>('/auth/reset-password', data).then((r) => r.data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get<{ user: User; unread_notifications: number }>('/me').then((r) => r.data),
}
