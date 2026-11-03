import { api } from '@/lib/api'
import type { User } from '@/types'

type AuthResponse = { token: string; user: User }

export const authService = {
  login: (login: string, password: string) => api.post<AuthResponse>('/auth/login', { login, password }).then((r) => r.data),
  register: (data: { name: string; username: string; email: string; phone?: string; password: string; password_confirmation: string }) =>
    api.post<AuthResponse>('/auth/register', data).then((r) => r.data),
  google: (credential: string) => api.post<AuthResponse>('/auth/google', { credential }).then((r) => r.data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get<{ user: User; unread_notifications: number }>('/me').then((r) => r.data),
}
