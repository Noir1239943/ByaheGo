import { api } from '@/lib/api'
import type { Hub, Paginated, Quote, Review, VehicleCard, VehicleDetail } from '@/types'

export type VehicleFilters = Record<string, string | number | boolean | undefined | null>

const clean = (f: VehicleFilters) => Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '' && v !== undefined && v !== null && v !== false))

export type VehicleListResponse = Paginated<VehicleCard> & {
  facets: { types: Record<string, number>; price_range: { min: number; max: number } }
}

export type MapResponse = {
  data: VehicleCard[]
  counts: { available: number; booked: number; on_trip: number }
  updated_at: string
}

export const vehicleService = {
  list: (filters: VehicleFilters) => api.get<VehicleListResponse>('/vehicles', { params: clean(filters) }).then((r) => r.data),
  map: (filters: VehicleFilters) => api.get<MapResponse>('/vehicles/map', { params: clean(filters) }).then((r) => r.data),
  get: (id: number | string) => api.get<VehicleDetail>(`/vehicles/${id}`).then((r) => r.data),
  reviews: (id: number | string, page = 1) => api.get<Paginated<Review>>(`/vehicles/${id}/reviews`, { params: { page } }).then((r) => r.data),
  quote: (id: number | string, body: { pickup_at: string; return_at: string; rental_type?: string; protection_plan?: string }) =>
    api.post<Quote>(`/vehicles/${id}/quote`, body).then((r) => r.data),
  hubs: () => api.get<{ data: Hub[] }>('/hubs').then((r) => r.data.data),
  stats: () => api.get<{ vehicles: number; hosts: number; cities: number; avg_rating: number; min_rate: number }>('/stats').then((r) => r.data),
}
