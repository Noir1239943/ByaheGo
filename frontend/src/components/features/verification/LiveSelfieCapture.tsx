import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CheckCircle2, Circle, Loader2, RefreshCw, ScanFace } from 'lucide-react'
import { Alert, Button } from '@/components/ui'
import { getErrorMessage } from '@/lib/api'
import { cn } from '@/lib/cn'
import { ANTISPOOF_MIN, BLINK_MAX_MS, BLINK_MIN_MS, LIVENESS_MIN, LIVENESS_TIMEOUT_MS, SELFIE_MIN_FACE_PX } from '@/lib/verification/config'
import { dHash, detectLive, detectStill, faceSimilarity } from '@/lib/verification/human'
import type { SelfieAnalysis } from '@/lib/verification/types'
import { mediaService } from '@/services/media'

type Phase = 'idle' | 'loading' | 'challenge' | 'hold' | 'saving' | 'done' | 'error'

interface Props {
  /** Descriptor of the face on the license front; the selfie is matched against it. */
  licenseEmbedding: number[] | null
  onDone: (result: { mediaId: number; analysis: SelfieAnalysis } | null) => void
  error?: string
}

const median = (xs: number[]) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function cameraError(e: unknown) {
  const name = (e as { name?: string } | null)?.name
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Camera access was blocked. Allow the camera for this site in your browser settings, then try again.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return "We couldn't find a camera on this device. Please use a phone or laptop with a camera."
  if (name === 'NotReadableError') return 'Your camera is being used by another app. Close it and try again.'
  return getErrorMessage(e, "We couldn't start your camera. Please try again.")
}

/** Live camera capture only (no file upload): liveness challenge first, then a photo holding the license next to the face. */
export function LiveSelfieCapture({ licenseEmbedding, onDone, error }: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const running = useRef(false)
  const track = useRef({ blinked: false, left: false, right: false, blinkStart: 0, blinkEnd: 0, real: [] as number[], live: [] as number[] })
  const [phase, setPhase] = useState<Phase>('idle')
  const [hint, setHint] = useState('')
  const [progress, setProgress] = useState({ blink: false, left: false, right: false })
  const [message, setMessage] = useState('')
  const [count, setCount] = useState(0)
  const [preview, setPreview] = useState<string | null>(null)

  const stopCamera = useCallback(() => {
    running.current = false
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
  }, [])
  useEffect(() => stopCamera, [stopCamera])

  const fail = useCallback((text: string) => { stopCamera(); setMessage(text); setPhase('error') }, [stopCamera])

  const watchFace = useCallback(async (initial: 'challenge' | 'hold') => {
    let mode = initial
    const t = track.current
    const started = Date.now()
    while (running.current) {
      const el = video.current
      if (!el || el.readyState < 2) { await sleep(60); continue }
      const { faces, gestures } = await detectLive(el)
      if (!running.current) return
      if (mode === 'hold') {
        setHint(faces.length === 0 ? 'Bring your face back into the frame' : 'Hold your license next to your face, then tap Capture')
        continue
      }
      if (Date.now() - started > LIVENESS_TIMEOUT_MS) return fail("That took too long. Make sure you're in good light and try again.")
      const face = faces[0]
      if (faces.length === 0) { setHint('Position your face in the frame'); continue }
      if (faces.length > 1) { setHint('Only you should be in the frame for this step'); continue }
      if (Math.min(face.box.w * el.videoWidth, face.box.h * el.videoHeight) < SELFIE_MIN_FACE_PX) { setHint('Move a little closer to the camera'); continue }
      if (face.real !== null) t.real.push(face.real)
      if (face.live !== null) t.live.push(face.live)

      const blinking = gestures.includes('blink left eye') || gestures.includes('blink right eye')
      if (blinking) t.blinkStart = performance.now()
      if (t.blinkStart > 0 && !blinking) {
        t.blinkEnd = performance.now()
        const len = Math.abs(t.blinkEnd - t.blinkStart)
        if (len > BLINK_MIN_MS && len < BLINK_MAX_MS) t.blinked = true
        t.blinkStart = 0
      }
      if (gestures.includes('facing left')) t.left = true
      if (gestures.includes('facing right')) t.right = true
      setProgress((p) => (p.blink === t.blinked && p.left === t.left && p.right === t.right ? p : { blink: t.blinked, left: t.left, right: t.right }))
      setHint(!t.blinked ? 'Blink your eyes' : !t.left ? 'Slowly turn your head to the left' : !t.right ? 'Now turn your head to the right' : 'Looking good…')

      if (t.blinked && t.left && t.right && t.real.length >= 8) {
        const real = median(t.real)
        const live = median(t.live)
        if (real < ANTISPOOF_MIN) return fail("This looks like a photo or screen, not a real face. Use your live camera in good light and try again.")
        if (live < LIVENESS_MIN) return fail("We couldn't confirm you're a live person. Try again in good light, facing the camera.")
        mode = 'hold'
        setPhase('hold')
      }
    }
  }, [fail])

  const start = async () => {
    setMessage('')
    setPreview(null)
    onDone(null)
    track.current = { blinked: false, left: false, right: false, blinkStart: 0, blinkEnd: 0, real: [], live: [] }
    setProgress({ blink: false, left: false, right: false })
    if (!navigator.mediaDevices?.getUserMedia) return fail('Your browser can only use the camera on a secure (HTTPS) connection. Please open the site over HTTPS.')
    setPhase('loading')
    setHint('Starting the camera…')
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } })
    } catch (e) {
      return fail(cameraError(e))
    }
    const el = video.current
    if (!el) return stopCamera()
    el.srcObject = stream.current
    try {
      await el.play()
      setHint('Loading face checks…')
      await detectLive(el) // loads the models (first time only)
    } catch (e) {
      return fail(getErrorMessage(e, "We couldn't start the face checks on this device. Please try again or use another device."))
    }
    running.current = true
    setPhase('challenge')
    void watchFace('challenge')
  }

  const capture = async () => {
    const el = video.current
    if (!el) return
    for (let n = 3; n > 0; n--) { setCount(n); await sleep(1000) }
    setCount(0)
    running.current = false
    setPhase('saving')
    await sleep(300) // let any in-flight detection finish
    try {
      const canvas = document.createElement('canvas')
      canvas.width = el.videoWidth
      canvas.height = el.videoHeight
      canvas.getContext('2d')?.drawImage(el, 0, 0)
      const faces = await detectStill(canvas)
      if (!faces.length) {
        running.current = true
        setPhase('hold')
        setMessage("We couldn't see your face in that photo. Look at the camera and try again.")
        void watchFace('hold')
        return
      }
      const user = faces[0]
      const second = faces[1]
      const similarity = licenseEmbedding && user.embedding ? await faceSimilarity(licenseEmbedding, user.embedding) : null
      const t = track.current
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
      if (!blob) throw new Error('capture failed')
      const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' })
      const analysis: SelfieAnalysis = {
        faceCount: faces.length,
        box: user.box,
        similarity,
        liveness: median(t.live),
        antispoof: median(t.real),
        blinked: t.blinked,
        turned: t.left && t.right,
        licenseFaceSeen: !!second && second.area < user.area * 0.8,
        hash: dHash(canvas),
      }
      const res = await mediaService.upload(file, 'selfie')
      setPreview(URL.createObjectURL(blob))
      stopCamera()
      setPhase('done')
      onDone({ mediaId: res.id, analysis })
    } catch (e) {
      fail(getErrorMessage(e, "We couldn't save that photo. Please try again."))
    }
  }

  const active = phase === 'loading' || phase === 'challenge' || phase === 'hold' || phase === 'saving'
  const steps = [['Blink', progress.blink], ['Turn left', progress.left], ['Turn right', progress.right]] as const

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-ink-700">Live selfie with your license</span>
      <div className={cn('relative overflow-hidden rounded-2xl border-2 bg-ink-900', error ? 'border-danger/60' : phase === 'done' ? 'border-brand/40' : 'border-line-200')}>
        <div className="relative aspect-[4/3] w-full">
          <video ref={video} playsInline muted className={cn('absolute inset-0 h-full w-full -scale-x-100 object-cover', !active && 'hidden')} />
          {phase === 'done' && preview && <img src={preview} alt="Your live selfie" className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />}
          {phase === 'done' && !preview && <div className="absolute inset-0 flex items-center justify-center bg-white text-sm text-ink-500">Selfie saved</div>}
          {(phase === 'idle' || phase === 'error') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white p-5 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand"><ScanFace className="size-6" /></span>
              <p className="max-w-xs text-sm text-ink-500">We'll ask you to blink and turn your head, then take a photo of you holding your license next to your face. Live camera only – no uploads.</p>
              <Button size="sm" icon={<Camera className="size-4" />} onClick={() => void start()}>{phase === 'error' ? 'Try again' : 'Start camera'}</Button>
            </div>
          )}
          {(phase === 'loading' || phase === 'saving') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink-900/60 text-white">
              <Loader2 className="size-7 animate-spin" />
              <p className="text-sm font-medium">{phase === 'saving' ? 'Checking your photos…' : hint}</p>
            </div>
          )}
          {count > 0 && <div className="absolute inset-0 flex items-center justify-center bg-ink-900/30 text-7xl font-extrabold text-white">{count}</div>}
        </div>
        {(phase === 'challenge' || phase === 'hold') && (
          <div className="space-y-2 bg-ink-900 p-3 text-white">
            <p className="text-sm font-semibold">{hint}</p>
            {phase === 'challenge' && (
              <div className="flex flex-wrap gap-3 text-xs">
                {steps.map(([label, ok]) => (
                  <span key={label} className="flex items-center gap-1">{ok ? <CheckCircle2 className="size-4 text-success" /> : <Circle className="size-4 text-white/50" />}{label}</span>
                ))}
              </div>
            )}
            {phase === 'hold' && <Button size="sm" disabled={count > 0} icon={<Camera className="size-4" />} onClick={() => void capture()}>Capture</Button>}
          </div>
        )}
        {phase === 'done' && (
          <div className="absolute right-2 bottom-2">
            <button type="button" onClick={() => void start()} className="flex items-center gap-1 rounded-lg bg-white/95 px-2.5 py-1.5 text-xs font-semibold shadow-sm"><RefreshCw className="size-3.5" /> Retake</button>
          </div>
        )}
      </div>
      {message && phase !== 'idle' && <Alert tone="danger">{message}</Alert>}
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
      {!licenseEmbedding && phase !== 'done' && <p className="text-xs text-ink-500">Tip: add the front of your license first so we can match your face to it.</p>}
    </div>
  )
}
