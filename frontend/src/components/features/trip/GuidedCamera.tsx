import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, ImageUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import { fileToStampedJpeg, readPosition, toStampedJpeg, type CaptureMeta } from '@/lib/trip/capture'
import { mediaService } from '@/services/media'
import type { ShotAngle } from '@/types'
import { ShotGuide } from './ShotGuide'

function cameraError(e: unknown) {
  const name = (e as { name?: string } | null)?.name
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Camera access is blocked. Allow the camera for this site, or upload a photo instead (it will be marked "uploaded, not live").'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera found on this device. You can upload a photo instead (marked "uploaded, not live").'
  if (name === 'NotReadableError') return 'The camera is being used by another app. Close it, or upload a photo instead.'
  return 'We could not start the camera. You can upload a photo instead (marked "uploaded, not live").'
}

interface Props {
  angle: ShotAngle | 'damage'
  label: string
  hint?: string
  /** The check-in photo of this angle, shown faintly over the camera at check-out so the framing matches. */
  ghostMediaId?: number | null
  /** The text burned into the photo, e.g. "BG-20578 · Front · Nov 3, 2026, 10:21 AM". */
  stamp: (label: string) => string
  onCapture: (blob: Blob, meta: CaptureMeta) => void
  busy?: boolean
}

/**
 * Live camera for one shot: rear camera, an outline guide, an optional faint "ghost" of the matching check-in photo.
 * A photo picked from the gallery is accepted only as a fallback and is marked as not live.
 */
export function GuidedCamera({ angle, label, hint, ghostMediaId, stamp, onCapture, busy }: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const position = useRef<{ lat: number; lng: number } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ghost, setGhost] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
    setReady(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    void readPosition().then((p) => { if (!cancelled) position.current = p })
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setError('The live camera needs a secure (HTTPS) connection. You can upload a photo instead (marked "uploaded, not live").')
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } })
        if (cancelled) return s.getTracks().forEach((t) => t.stop())
        stream.current = s
        const el = video.current
        if (!el) return
        el.srcObject = s
        await el.play()
        if (!cancelled) setReady(true)
      } catch (e) {
        if (!cancelled) setError(cameraError(e))
      }
    }
    void start()
    return () => { cancelled = true; stop() }
  }, [stop])

  useEffect(() => {
    if (!ghostMediaId) return
    let url: string | null = null
    let cancelled = false
    mediaService.objectUrl(ghostMediaId, 1000).then((u) => { url = u; if (!cancelled) setGhost(u) }).catch(() => undefined)
    return () => { cancelled = true; setGhost(null); if (url) URL.revokeObjectURL(url) }
  }, [ghostMediaId])

  const snap = async () => {
    const el = video.current
    if (!el || !ready || working) return
    setWorking(true)
    try {
      const when = new Date()
      const blob = await toStampedJpeg(el, el.videoWidth, el.videoHeight, stamp(label))
      onCapture(blob, { live: true, device_time: when.toISOString(), lat: position.current?.lat ?? null, lng: position.current?.lng ?? null })
    } finally {
      setWorking(false)
    }
  }

  const pick = async (file: File | undefined) => {
    if (!file) return
    setWorking(true)
    try {
      const blob = await fileToStampedJpeg(file, stamp(label))
      onCapture(blob, { live: false, device_time: new Date().toISOString(), lat: position.current?.lat ?? null, lng: position.current?.lng ?? null })
    } finally {
      setWorking(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <div>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-ink-900 sm:aspect-video">
        <video ref={video} playsInline muted className={cn('absolute inset-0 size-full object-cover', !ready && 'invisible')} data-testid="camera-video" />
        {ghost && <img src={ghost} alt="" className="pointer-events-none absolute inset-0 size-full object-cover opacity-30" data-testid="ghost" />}
        <ShotGuide angle={angle} className={cn('pointer-events-none absolute inset-0 size-full p-4', ghost ? 'opacity-40' : 'opacity-80')} />
        <span className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">{label}</span>
        {ghost && <span className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">Line it up with your check-in photo</span>}
        {!ready && !error && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-white"><Loader2 className="size-6 animate-spin" /> Starting the camera…</div>}
        {error && <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white">{error}</div>}
      </div>
      {hint && <p className="mt-2 text-sm text-ink-500">{hint}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button size="lg" icon={<Camera className="size-5" />} onClick={() => void snap()} disabled={!ready || busy} loading={working || busy} data-testid="take-photo">Take photo</Button>
        <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} data-testid="upload-input" />
        <Button variant="ghost" icon={<ImageUp className="size-4" />} onClick={() => fileInput.current?.click()} disabled={busy}>Upload instead</Button>
      </div>
    </div>
  )
}
