import { useEffect, useRef } from 'react'

/**
 * Runs `callback` every `ms` milliseconds, but only while the tab is visible. A hidden tab makes no requests at all; when it
 * is shown again the callback runs straight away if it is due, so what the person sees is never old.
 */
export function useVisibleInterval(callback: () => void, ms: number, enabled = true) {
  const saved = useRef(callback)
  useEffect(() => {
    saved.current = callback
  })
  useEffect(() => {
    if (!enabled) return
    let last = Date.now()
    const run = () => {
      last = Date.now()
      saved.current()
    }
    const id = window.setInterval(() => {
      if (!document.hidden) run()
    }, ms)
    const onVisible = () => {
      if (!document.hidden && Date.now() - last >= ms) run()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [ms, enabled])
}
