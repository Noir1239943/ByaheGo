import { api } from '@/lib/api'
import type { Booking, BookingRow } from '@/types'

export type TripsResponse = { data: BookingRow[]; counts: Record<'upcoming' | 'active' | 'past' | 'cancelled', number> }

export const bookingService = {
  list: (tab: string) => api.get<TripsResponse>('/bookings', { params: { tab } }).then((r) => r.data),
  get: (reference: string) => api.get<Booking>(`/bookings/${reference}`).then((r) => r.data),
  create: (body: Record<string, unknown>) => api.post<Booking>('/bookings', body).then((r) => r.data),
  cancel: (reference: string, reason?: string) => api.post<Booking>(`/bookings/${reference}/cancel`, { reason }).then((r) => r.data),
  payBalance: (reference: string, body: Record<string, unknown>) => api.post<Booking>(`/bookings/${reference}/pay-balance`, body).then((r) => r.data),
  review: (reference: string, body: { rating: number; comment?: string }) => api.post<Booking>(`/bookings/${reference}/review`, body).then((r) => r.data),
  reportIncident: (reference: string, body: { type: string; description: string; photo_ids?: number[] }) =>
    api.post<Booking>(`/bookings/${reference}/incidents`, body).then((r) => r.data),
}
