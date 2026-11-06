import { Navigate, useSearchParams } from 'react-router'

/** The old /vehicles/map address now opens the list page in map view, with the same filters. */
export default function MapPage() {
  const [params] = useSearchParams()
  const next = new URLSearchParams(params)
  next.set('view', 'map')
  return <Navigate to={`/vehicles?${next.toString()}`} replace />
}
