import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { vehicleService } from '@/services/vehicles'

export function useVehicle() {
  const { id = '' } = useParams()
  return useQuery({ queryKey: ['vehicle', id], queryFn: () => vehicleService.get(id), enabled: !!id })
}
