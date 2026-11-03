import { useEffect } from 'react'
import { useRouteHandle } from '@/hooks/useRouteHandle'

/** Sets the browser tab title from the current route's `handle.title`. */
export function TitleManager() {
  const { title } = useRouteHandle()
  useEffect(() => {
    document.title = title ? `${title} · ByaheGo` : 'ByaheGo – Car Rental in Cebu'
  }, [title])
  return null
}
