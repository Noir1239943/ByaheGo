import { api } from '@/lib/api'
import type { Booking, BookingRow, HostVehicle } from '@/types'

export type BlockedDate = { id: number; starts_on: string; ends_on: string; reason: string | null }

export type HostDashboard = {
  stats: { earnings_this_month: number; upcoming_bookings: number; active_trips: number; live_listings: number; total_listings: number; rating: number; reviews: number; pending_payouts: number }
  setup: { account: boolean; identity: boolean; payout: boolean; vehicle: boolean }
  today: BookingRow[]
  recent: BookingRow[]
}

export type HostEarnings = {
  summary: { lifetime: number; this_month: number; paid_out: number; scheduled: number; trips: number }
  months: { label: string; month: string; amount: number }[]
  payouts: { id: number; amount: number; status: string; scheduled_for: string | null; paid_at: string | null; reference: string | null; booking_reference: string | null; vehicle_name: string | null }[]
  payout_account: { method: string; account_name: string; account_masked: string } | null
}

export const hostService = {
  dashboard: () => api.get<HostDashboard>('/host/dashboard').then((r) => r.data),
  earnings: () => api.get<HostEarnings>('/host/earnings').then((r) => r.data),
  vehicles: (params: { status?: string; q?: string }) => api.get<{ data: HostVehicle[]; counts: Record<string, number> }>('/host/vehicles', { params }).then((r) => r.data),
  vehicle: (id: number | string) => api.get<HostVehicle>(`/host/vehicles/${id}`).then((r) => r.data),
  createVehicle: (body: Record<string, unknown>) => api.post<HostVehicle>('/host/vehicles', body).then((r) => r.data),
  updateVehicle: (id: number, body: Record<string, unknown>) => api.put<HostVehicle>(`/host/vehicles/${id}`, body).then((r) => r.data),
  submitVehicle: (id: number) => api.post<HostVehicle>(`/host/vehicles/${id}/submit`).then((r) => r.data),
  pauseVehicle: (id: number) => api.post<HostVehicle>(`/host/vehicles/${id}/pause`).then((r) => r.data),
  resumeVehicle: (id: number) => api.post<HostVehicle>(`/host/vehicles/${id}/resume`).then((r) => r.data),
  deleteVehicle: (id: number) => api.delete(`/host/vehicles/${id}`),
  blockedDates: (id: number) => api.get<{ data: BlockedDate[] }>(`/host/vehicles/${id}/blocked-dates`).then((r) => r.data.data),
  blockDates: (id: number, body: { starts_on: string; ends_on: string; reason?: string }) => api.post<BlockedDate>(`/host/vehicles/${id}/blocked-dates`, body).then((r) => r.data),
  unblockDates: (id: number, blockId: number) => api.delete(`/host/vehicles/${id}/blocked-dates/${blockId}`),
  bookings: (params: { tab: string; q?: string }) => api.get<{ data: BookingRow[]; counts: Record<string, number> }>('/host/bookings', { params }).then((r) => r.data),
  booking: (reference: string) => api.get<Booking>(`/host/bookings/${reference}`).then((r) => r.data),
  pickup: (reference: string, body: Record<string, unknown>) => api.post<Booking>(`/host/bookings/${reference}/pickup`, body).then((r) => r.data),
  return: (reference: string, body: Record<string, unknown>) => api.post<Booking>(`/host/bookings/${reference}/return`, body).then((r) => r.data),
  incident: (reference: string, body: Record<string, unknown>) => api.post<Booking>(`/host/bookings/${reference}/incidents`, body).then((r) => r.data),
}
