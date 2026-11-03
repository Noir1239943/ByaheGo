import { useMatches } from 'react-router'

export type RouteHandle = { title?: string; subtitle?: string; step?: number }

/** The deepest route's `handle` (page title, subtitle, checkout step). */
export function useRouteHandle(): RouteHandle {
  const matches = useMatches()
  for (let i = matches.length - 1; i >= 0; i--) {
    const h = matches[i].handle as RouteHandle | undefined
    if (h?.title) return h
  }
  return {}
}
