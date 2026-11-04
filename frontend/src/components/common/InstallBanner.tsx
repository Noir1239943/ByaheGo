import { useState } from 'react'
import { Download, Share, X } from 'lucide-react'
import { Button } from '@/components/ui'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import logoMarkSrc from '@/assets/logo-mark.png'

/** Small banner that invites mobile visitors to install ByaheGo as an app (PWA). */
export function InstallBanner() {
  const { canInstall, installed, install } = useInstallPrompt()
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem('byahego_install_dismissed') === '1' } catch { return false }
  })
  // iPhone Safari has no install button for websites: show where to find "Add to Home Screen" instead.
  const ua = navigator.userAgent
  const iosSafari = /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua) && !(navigator as Navigator & { standalone?: boolean }).standalone && !installed
  if ((!canInstall && !iosSafari) || hidden) return null
  const dismiss = () => {
    setHidden(true)
    try { localStorage.setItem('byahego_install_dismissed', '1') } catch { /* ignore */ }
  }
  return (
    <div className="no-print fixed inset-x-3 bottom-3 z-[900] mx-auto flex max-w-md animate-slide-up items-center gap-3 rounded-2xl border border-line-200 bg-white p-3 shadow-pop sm:bottom-5">
      <img src={logoMarkSrc} alt="" className="size-11" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">Get the ByaheGo app</p>
        {canInstall ? (
          <p className="text-xs text-ink-500">Faster booking and one tap from your home screen, no app store needed.</p>
        ) : (
          <p className="text-xs text-ink-500">Tap <Share className="inline size-3.5 align-text-bottom" /> Share, then <b>Add to Home Screen</b>.</p>
        )}
      </div>
      {canInstall && (
        <Button size="sm" icon={<Download className="size-4" />} onClick={() => void install()}>
          Install
        </Button>
      )}
      <button onClick={dismiss} className="flex size-11 items-center justify-center rounded-lg text-ink-400 hover:bg-line-100" aria-label="Dismiss">
        <X className="size-4" />
      </button>
    </div>
  )
}
