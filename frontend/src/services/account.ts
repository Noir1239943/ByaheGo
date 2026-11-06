import { api } from '@/lib/api'
import type { PageMeta } from '@/types'
import type { AppNotification, HostApplication, License, Payment, User, VehicleCard } from '@/types'

export type BillingResponse = {
  summary: { total_paid: number; total_refunded: number; refunds_pending: number; fees_and_charges: number; balance_due: number; deposits_on_hold: number }
  data: Payment[]
  meta: PageMeta
}

export type BillingParams = { type?: string; status?: string; from?: string; to?: string; page?: number }

export const accountService = {
  update: (body: Partial<User>) => api.put<{ user: User }>('/me', body).then((r) => r.data.user),
  password: (body: { current_password?: string; password: string; password_confirmation: string }) => api.put('/me/password', body),
  payout: (body: { payout_method: string; payout_account_name: string; payout_account_number: string }) =>
    api.put<{ user: User }>('/me/payout', body).then((r) => r.data.user),
  notifications: () => api.get<{ data: AppNotification[] }>('/me/notifications').then((r) => r.data.data),
  readNotification: (id: number) => api.post(`/me/notifications/${id}/read`),
  readAll: () => api.post('/me/notifications/read-all'),
  billing: (params: BillingParams = {}) => api.get<BillingResponse>('/me/billing', { params }).then((r) => r.data),
  favorites: () => api.get<{ data: VehicleCard[] }>('/me/favorites').then((r) => r.data.data),
  favoriteIds: () => api.get<{ data: number[] }>('/me/favorite-ids').then((r) => r.data.data),
  addFavorite: (id: number) => api.post(`/me/favorites/${id}`),
  removeFavorite: (id: number) => api.delete(`/me/favorites/${id}`),
  toggleAlert: (id: number) => api.post<{ price_alert: boolean }>(`/me/favorites/${id}/alert`).then((r) => r.data),
  recentlyViewed: () => api.get<{ data: VehicleCard[] }>('/me/recently-viewed').then((r) => r.data.data),
  clearRecentlyViewed: () => api.delete('/me/recently-viewed'),
  verification: () => api.get<{ status: string; license: License | null }>('/verification').then((r) => r.data),
  submitVerification: (body: Record<string, unknown>) => api.post<{ status: string; decision: 'approve' | 'reject' | 'review'; message: string | null; license: License }>('/verification', body).then((r) => r.data),
  hostApplication: () => api.get<{ application: HostApplication | null; can_apply: boolean }>('/host-application').then((r) => r.data),
  applyHost: (body: Record<string, unknown>) => api.post<{ application: HostApplication }>('/host-application', body).then((r) => r.data.application),
  contact: (body: Record<string, unknown>) => api.post<{ message: string }>('/support', body).then((r) => r.data),
}
