import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/api'
import { accountService } from '@/services/account'
import { useAuth } from './useAuth'

/** Saved vehicles: one cached list of ids, optimistic heart toggles everywhere. */
export function useFavorites() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()

  const { data: ids = [] } = useQuery({
    queryKey: ['favorite-ids'],
    queryFn: accountService.favoriteIds,
    enabled: !!user,
    staleTime: 60_000,
  })

  const mutation = useMutation({
    mutationFn: ({ id, save }: { id: number; save: boolean }) => (save ? accountService.addFavorite(id) : accountService.removeFavorite(id)),
    onMutate: async ({ id, save }) => {
      await qc.cancelQueries({ queryKey: ['favorite-ids'] })
      const prev = qc.getQueryData<number[]>(['favorite-ids']) ?? []
      qc.setQueryData<number[]>(['favorite-ids'], save ? [...prev, id] : prev.filter((x) => x !== id))
      return { prev }
    },
    onSuccess: (_d, { save }) => toast.success(save ? 'Saved to your list' : 'Removed from saved vehicles'),
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['favorite-ids'], ctx.prev)
      toast.error(getErrorMessage(err))
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['favorites'] }),
  })

  const isSaved = (id: number) => ids.includes(id)
  const toggle = (id: number) => {
    if (!user) {
      toast('Sign in to save vehicles you like.')
      navigate('/login', { state: { from: location.pathname + location.search } })
      return
    }
    mutation.mutate({ id, save: !isSaved(id) })
  }

  return { isSaved, toggle }
}
