import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui'

/** Two small notices: "you're offline" and "a new version is ready". */
export function PwaStatus() {
  const [online, setOnline] = useState(() => navigator.onLine)
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    // Look for a new version when the app is opened again after a while, not only on a full reload.
    onRegisteredSW: (_url, reg) => { if (reg) window.setInterval(() => void reg.update().catch(() => undefined), 60 * 60 * 1000) },
  })

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  return (
    <>
      {!online && (
        <div role="status" className="no-print fixed inset-x-0 top-0 z-[1000] flex items-center justify-center gap-2 bg-ink-900 px-3 py-2 text-center text-sm font-semibold text-white">
          <WifiOff className="size-4 shrink-0" /> You're offline. Saved pages still open, but bookings and payments need a connection.
        </div>
      )}
      {needRefresh && (
        <div role="status" className="no-print fixed inset-x-3 bottom-3 z-[1000] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line-200 bg-white p-3 shadow-pop">
          <RefreshCw className="size-5 shrink-0 text-brand" />
          <p className="min-w-0 flex-1 text-sm font-semibold">A new version of ByaheGo is ready.</p>
          <Button size="sm" onClick={() => void updateServiceWorker(true)}>Refresh</Button>
          <button onClick={() => setNeedRefresh(false)} className="rounded-lg px-2 py-1 text-sm text-ink-500 hover:bg-line-100">Later</button>
        </div>
      )}
    </>
  )
}
