import { api } from '@/lib/api'
import type { AgreementPreview } from '@/lib/agreement'

export type AgreementTrip = { pickup_at: string; return_at: string; rental_type: string; protection_plan: string }

export const agreementService = {
  preview: (vehicleId: number | string, trip: AgreementTrip) => api.post<AgreementPreview>(`/vehicles/${vehicleId}/agreement`, trip).then((r) => r.data),
}
