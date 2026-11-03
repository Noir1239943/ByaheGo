import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { PageLoader } from '@/components/common/States'
import { useAuth } from '@/hooks/useAuth'
import type { Role } from '@/types'

/** Pages that need a signed-in customer. Sends guests to sign in and back afterwards. */
export function RequireAuth({ roles, children }: { roles?: Role[]; children?: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={user.role === 'renter' ? '/account/host-application' : '/'} replace />
  }
  return children ?? <Outlet />
}

/** Sign-in pages: signed-in customers go straight to where they were heading. */
export function GuestOnly() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <PageLoader />
  if (user) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from ?? (user.role === 'admin' ? '/admin' : '/')} replace />
  }
  return <Outlet />
}
