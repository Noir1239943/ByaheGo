import { useCallback, useState } from 'react'

type Coords = { lat: number; lng: number }

/** Asks the browser for the customer's location (used for "nearest pick-up"). */
export function useGeolocation() {
  const [coords, setCoords] = useState<Coords | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const request = useCallback((): Promise<Coords | null> => {
    if (!('geolocation' in navigator)) {
      setError('Your browser can\'t share your location.')
      return Promise.resolve(null)
    }
    setLoading(true)
    setError(null)
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setCoords(c)
          setLoading(false)
          resolve(c)
        },
        () => {
          setError('We couldn\'t get your location. Allow location access or pick a city instead.')
          setLoading(false)
          resolve(null)
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
      )
    })
  }, [])

  return { coords, loading, error, request }
}
