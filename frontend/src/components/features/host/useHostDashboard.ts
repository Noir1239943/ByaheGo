import { useQuery } from '@tanstack/react-query'
import { hostService } from '@/services/host'

export function useHostDashboard() {
  return useQuery({ queryKey: ['host', 'dashboard'], queryFn: hostService.dashboard })
}
