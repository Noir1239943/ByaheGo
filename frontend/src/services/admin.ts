import { api } from '@/lib/api'
import type { Booking, BookingRow, HostApplication, HostVehicle, Incident, License, Paginated, Payment, Payout, SupportTicket, User, UserBrief } from '@/types'

export type AdminOverview = {
  kpis: { gross_booking_value: number; gbv_change: number | null; platform_revenue: number; bookings: number; active_rentals: number; returns_today: number; cancellation_rate: number; users: number; live_vehicles: number }
  attention: { verifications: number; listings: number; host_applications: number; disputes: number; payouts: number; support: number }
  months: { label: string; amount: number }[]
  recent: BookingRow[]
}

export type AdminUserRow = UserBrief & { bookings_count: number; vehicles_count: number; last_login_at: string | null }

type Params = Record<string, string | number | undefined>

export const adminService = {
  overview: (range: string) => api.get<AdminOverview>('/admin/overview', { params: { range } }).then((r) => r.data),
  users: (params: Params) => api.get<Paginated<AdminUserRow>>('/admin/users', { params }).then((r) => r.data),
  user: (id: number | string) => api.get<{ user: User; license: License | null; stats: Record<string, number>; bookings: BookingRow[] }>(`/admin/users/${id}`).then((r) => r.data),
  suspend: (id: number, reason: string) => api.post(`/admin/users/${id}/suspend`, { reason }),
  reinstate: (id: number) => api.post(`/admin/users/${id}/reinstate`),
  revokeVerification: (id: number, reason: string) => api.post(`/admin/users/${id}/revoke-verification`, { reason }),
  verifications: (params: Params) => api.get<Paginated<License>>('/admin/verifications', { params }).then((r) => r.data),
  verification: (id: number | string) => api.get<License>(`/admin/verifications/${id}`).then((r) => r.data),
  approveVerification: (id: number) => api.post<License>(`/admin/verifications/${id}/approve`).then((r) => r.data),
  overrideVerification: (id: number, decision: 'approve' | 'reject', note: string) => api.post<License>(`/admin/verifications/${id}/override`, { decision, note }).then((r) => r.data),
  rejectVerification: (id: number, reason: string) => api.post<License>(`/admin/verifications/${id}/reject`, { reason }).then((r) => r.data),
  hostApplications: (params: Params) => api.get<Paginated<HostApplication>>('/admin/host-applications', { params }).then((r) => r.data),
  approveHost: (id: number, notes?: string) => api.post(`/admin/host-applications/${id}/approve`, { notes }),
  rejectHost: (id: number, notes: string) => api.post(`/admin/host-applications/${id}/reject`, { notes }),
  listings: (params: Params) => api.get<Paginated<HostVehicle> & { counts: Record<string, number> }>('/admin/listings', { params }).then((r) => r.data),
  listing: (id: number | string) => api.get<HostVehicle>(`/admin/listings/${id}`).then((r) => r.data),
  approveListing: (id: number) => api.post(`/admin/listings/${id}/approve`),
  rejectListing: (id: number, reason: string) => api.post(`/admin/listings/${id}/reject`, { reason }),
  suspendListing: (id: number) => api.post(`/admin/listings/${id}/suspend`),
  bookings: (params: Params) =>
    api.get<Paginated<BookingRow> & { counts: Record<string, number>; summary: Record<string, number> }>('/admin/bookings', { params }).then((r) => r.data),
  booking: (reference: string) => api.get<Booking>(`/admin/bookings/${reference}`).then((r) => r.data),
  cancelBooking: (reference: string, reason: string, refund: boolean) => api.post<Booking>(`/admin/bookings/${reference}/cancel`, { reason, refund }).then((r) => r.data),
  refund: (reference: string, amount: number, reason: string) => api.post<Booking>(`/admin/bookings/${reference}/refund`, { amount, reason }).then((r) => r.data),
  note: (reference: string, note: string) => api.post<Booking>(`/admin/bookings/${reference}/note`, { note }).then((r) => r.data),
  message: (reference: string, to: 'renter' | 'host', message: string) => api.post(`/admin/bookings/${reference}/message`, { to, message }),
  payments: (params: Params) => api.get<Paginated<Payment> & { summary: { collected: number; refunded: number; fees: number } }>('/admin/payments', { params }).then((r) => r.data),
  payouts: (params: Params) => api.get<Paginated<Payout> & { summary: { scheduled: number; paid: number; due_now: number } }>('/admin/payouts', { params }).then((r) => r.data),
  markPaid: (id: number) => api.post(`/admin/payouts/${id}/mark-paid`),
  disputes: (params: Params) => api.get<Paginated<Incident>>('/admin/disputes', { params }).then((r) => r.data),
  resolveDispute: (id: number, body: { action: 'charge' | 'dismiss'; amount?: number; notes?: string; suspend_renter?: boolean }) =>
    api.post<Incident>(`/admin/disputes/${id}/resolve`, body).then((r) => r.data),
  support: (params: Params) => api.get<Paginated<SupportTicket>>('/admin/support', { params }).then((r) => r.data),
  replySupport: (id: number, reply: string) => api.post(`/admin/support/${id}/reply`, { reply }),
  settings: () => api.get<{ values: Record<string, number>; labels: Record<string, string> }>('/admin/settings').then((r) => r.data),
  updateSettings: (values: Record<string, number>) => api.put<{ values: Record<string, number>; labels: Record<string, string> }>('/admin/settings', values).then((r) => r.data),
}
