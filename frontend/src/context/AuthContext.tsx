import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { tokenStore } from '@/lib/api'
import { authService } from '@/services/auth'
import type { User } from '@/types'
import { AuthContext, type AuthContextValue } from './auth-context'


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(() => !!tokenStore.get())
  const queryClient = useQueryClient()

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const data = await authService.me()
      setUser(data.user)
      setUnread(data.unread_notifications)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Keep the notification badge fresh while the tab is open.
  useEffect(() => {
    if (!user) return
    const id = window.setInterval(() => void refresh(), 60000)
    return () => window.clearInterval(id)
  }, [user, refresh])

  useEffect(() => {
    const onSignedOut = (e: Event) => {
      const code = (e as CustomEvent<{ code?: string }>).detail?.code
      setUser(null)
      queryClient.clear()
      toast.error(code === 'account_blocked' ? 'Your account is on hold. Sign in again to see why and how to appeal.' : 'Your session ended. Please sign in again.')
    }
    window.addEventListener('byahego:signed-out', onSignedOut)
    return () => window.removeEventListener('byahego:signed-out', onSignedOut)
  }, [queryClient])

  const finish = useCallback(
    async (res: { token: string; user: User }) => {
      tokenStore.set(res.token)
      queryClient.clear()
      setUser(res.user)
      await refresh()
      return res.user
    },
    [queryClient, refresh],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      unread,
      login: async (login, password) => finish(await authService.login(login, password)),
      register: async (data) => finish(await authService.register(data)),
      socialSession: finish,
      logout: async () => {
        try {
          await authService.logout()
        } catch {
          /* already signed out */
        }
        tokenStore.clear()
        setUser(null)
        setUnread(0)
        queryClient.clear()
      },
      refresh,
      setUser,
    }),
    [user, loading, unread, finish, refresh, queryClient],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
