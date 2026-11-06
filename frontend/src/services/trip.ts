import { api } from '@/lib/api'
import type { Booking, ShotAngle } from '@/types'

export type TripStage = 'checkin' | 'checkout'

export interface Wizard {
  stage: TripStage
  angles: { key: ShotAngle; label: string }[]
  drafts: { id: number; angle: ShotAngle | 'damage'; media_id: number; live: boolean; note: string | null }[]
  /** At check-out: the matching check-in photo of each angle, shown faintly over the camera. */
  ghosts: Partial<Record<ShotAngle, number>>
  checkin_odometer: number | null
  checkin_fuel_level: number | null
  submitted: boolean
  can_start: boolean
  opens_at: string | null
}

export interface PhotoMeta {
  angle: string
  live: boolean
  device_time: string
  lat?: number | null
  lng?: number | null
  note?: string
}

function photoForm(blob: Blob, meta: PhotoMeta) {
  const form = new FormData()
  form.append('file', blob, `${meta.angle}.jpg`)
  form.append('angle', meta.angle)
  form.append('live', meta.live ? '1' : '0')
  form.append('device_time', meta.device_time)
  if (meta.lat != null && meta.lng != null) {
    form.append('lat', String(meta.lat))
    form.append('lng', String(meta.lng))
  }
  if (meta.note) form.append('note', meta.note)
  return form
}

export const tripService = {
  wizard: (reference: string, stage: TripStage) => api.get<Wizard>(`/bookings/${reference}/inspection/${stage}`).then((r) => r.data),
  uploadPhoto: (reference: string, stage: TripStage, blob: Blob, meta: PhotoMeta) =>
    api.post<{ id: number; angle: string; media_id: number; live: boolean }>(`/bookings/${reference}/inspection/${stage}/photos`, photoForm(blob, meta)).then((r) => r.data),
  deletePhoto: (reference: string, stage: TripStage, id: number) => api.delete(`/bookings/${reference}/inspection/${stage}/photos/${id}`),
  submit: (reference: string, stage: TripStage, body: { odometer: number; fuel_level: number; notes?: string }) =>
    api.post<Booking>(`/bookings/${reference}/inspection/${stage}`, body).then((r) => r.data),
  /** Opens (or reopens) the Xendit page for an extension the host approved. `checkout_url` is null when it is already paid. */
  payExtension: (reference: string, payment_method?: string) =>
    api.post<{ checkout_url: string | null; booking: Booking }>(`/bookings/${reference}/extension/pay`, { payment_method }).then((r) => r.data),
  requestExtension: (reference: string, body: { return_at: string; note?: string }) => api.post<Booking>(`/bookings/${reference}/extension`, body).then((r) => r.data),
  /** The host adds their own photo to the renter's check-in. */
  hostAddPhoto: (reference: string, blob: Blob, meta: Omit<PhotoMeta, 'angle'>) =>
    api.post<Booking>(`/host/bookings/${reference}/checkin/photos`, photoForm(blob, { ...meta, angle: 'host_extra' })).then((r) => r.data),
}
