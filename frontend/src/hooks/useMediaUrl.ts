import { useEffect, useState } from 'react'
import { mediaService } from '@/services/media'

/** A private photo as a blob URL (it needs the sign-in token, so a plain <img src> can't load it). */
export function useMediaUrl(id: number | null | undefined, width?: number) {
  const [state, setState] = useState<{ id: number | null; url: string | null; failed: boolean }>({ id: null, url: null, failed: false })
  useEffect(() => {
    if (!id) return
    let objectUrl: string | null = null
    let cancelled = false
    mediaService
      .objectUrl(id, width)
      .then((u) => { objectUrl = u; if (!cancelled) setState({ id, url: u, failed: false }) })
      .catch(() => { if (!cancelled) setState({ id, url: null, failed: true }) })
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [id, width])
  const ready = state.id === (id ?? null)
  return { url: ready ? state.url : null, failed: ready ? state.failed : false, loading: !!id && !ready }
}
