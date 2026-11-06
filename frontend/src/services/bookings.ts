import { api } from '@/lib/api'
import type { Booking, BookingRow } from '@/types'

export type TripsResponse = { data: BookingRow[]; counts: Record<'upcoming' | 'active' | 'past' | 'cancelled', number> }

export const bookingService = {
  list: (tab: string) => api.get<TripsResponse>('/bookings', { params: { tab } }).then((r) => r.data),
  get: (reference: string) => api.get<Booking>(`/bookings/${reference}`).then((r) => r.data),
  create: (body: Record<string, unknown>) => api.post<Booking>('/bookings', body).then((r) => r.data),
  cancel: (reference: string, reason?: string) => api.post<Booking>(`/bookings/${reference}/cancel`, { reason }).then((r) => r.data),
  /** Opens Xendit's payment page for the balance; the page redirects there. */
  payBalance: (reference: string, payment_method: string) => api.post<{ checkout_url: string }>(`/bookings/${reference}/pay-balance`, { payment_method }).then((r) => r.data),
  /** Asks the server to check with Xendit whether the booking was paid (works on localhost, where webhooks can't reach). */
  verifyPayment: (reference: string) => api.post<Booking>(`/bookings/${reference}/verify-payment`).then((r) => r.data),
  /** Back to the payment page of an unpaid booking. */
  pay: (reference: string, payment_method?: string) => api.post<{ checkout_url: string | null; booking: Booking }>(`/bookings/${reference}/pay`, { payment_method }).then((r) => r.data),
  review: (reference: string, body: { rating: number; comment?: string }) => api.post<Booking>(`/bookings/${reference}/review`, body).then((r) => r.data),
  reportIncident: (reference: string, body: { type: string; description: string; photo_ids?: number[] }) =>
    api.post<Booking>(`/bookings/${reference}/incidents`, body).then((r) => r.data),
}
