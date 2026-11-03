import { createContext } from 'react'
import type { authService } from '@/services/auth'
import type { User } from '@/types'

export type AuthContextValue = {
  user: User | null
  loading: boolean
  unread: number
  login: (login: string, password: string) => Promise<User>
  register: (data: Parameters<typeof authService.register>[0]) => Promise<User>
  googleLogin: (credential: string) => Promise<User>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  setUser: (u: User) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
