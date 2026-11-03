import { useRef, useState } from 'react'
import { Camera, Loader2, RefreshCw, Trash2, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage, mediaUrl } from '@/lib/api'
import { cn } from '@/lib/cn'
import { mediaService, type MediaPurpose } from '@/services/media'
import { ProtectedImage } from './ProtectedImage'

type SingleProps = {
  purpose: MediaPurpose
  value: number | null
  onChange: (id: number | null) => void
  label: string
  hint?: string
  error?: string
  privateFile?: boolean
  capture?: 'user' | 'environment'
  className?: string
  /** Runs on the device before upload (e.g. face / text checks). Return a message to block the photo. */
  precheck?: (file: File) => Promise<string | null>
  /** Fired when the photo is removed or replaced, so callers can drop results from the old one. */
  onClear?: () => void
}

/** Upload one photo (license, selfie, OR/CR). Photos are compressed on the phone first. */
export function ImageUploader({ purpose, value, onChange, label, hint, error, privateFile = true, capture, className, precheck, onClear }: SingleProps) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [blocked, setBlocked] = useState<string | null>(null)

  const pick = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('Please choose a photo (JPG, PNG or WEBP).')
    setBusy(true)
    setBlocked(null)
    setPreview(URL.createObjectURL(file))
    try {
      if (precheck) {
        setChecking(true)
        onChange(null)
        onClear?.()
        let problem: string | null = null
        try {
          problem = await precheck(file)
        } catch {
          problem = null // the on-device checker couldn't run; the server still reviews the photo
        } finally {
          setChecking(false)
        }
        if (problem) {
          setBlocked(problem)
          setPreview(null)
          return
        }
      }
      const res = await mediaService.upload(file, purpose)
      onChange(res.id)
    } catch (e) {
      setPreview(null)
      toast.error(getErrorMessage(e, 'Upload failed. Please try again.'))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-sm font-medium text-ink-700">{label}</span>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          void pick(e.dataTransfer.files?.[0])
        }}
        className={cn('relative flex aspect-[16/10] flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed bg-white text-center transition', error ? 'border-danger/60' : value ? 'border-brand/40' : 'border-line-200 hover:border-brand/50')}
      >
        {value || preview ? (
          <>
            {preview ? <img src={preview} alt={label} className="h-full w-full object-contain" /> : privateFile ? <ProtectedImage id={value} alt={label} className="h-full w-full" /> : <img src={mediaUrl(value) ?? ''} alt={label} className="h-full w-full object-cover" />}
            {busy && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                <div className="flex flex-col items-center gap-2"><Loader2 className="size-6 animate-spin text-brand" />{checking && <span className="text-xs font-semibold text-ink-700">Checking your photos…</span>}</div>
              </div>
            )}
            {!busy && (
              <div className="absolute right-2 bottom-2 flex gap-1.5">
                <button type="button" onClick={() => input.current?.click()} className="flex items-center gap-1 rounded-lg bg-white/95 px-2.5 py-1.5 text-xs font-semibold shadow-sm">
                  <RefreshCw className="size-3.5" /> Replace
                </button>
                <button type="button" onClick={() => { setPreview(null); setBlocked(null); onChange(null); onClear?.() }} className="rounded-lg bg-white/95 p-1.5 text-danger shadow-sm" aria-label="Remove photo">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            )}
          </>
        ) : (
          <button type="button" onClick={() => input.current?.click()} className="flex h-full w-full flex-col items-center justify-center gap-2 p-4">
            <span className="flex size-10 items-center justify-center rounded-full bg-brand-soft text-brand">
              {capture ? <Camera className="size-5" /> : <UploadCloud className="size-5" />}
            </span>
            <span className="text-sm font-semibold text-ink-900">
              {capture ? 'Take or upload a photo' : <>Drag a photo here or <span className="text-brand">browse</span></>}
            </span>
            {hint && <span className="text-xs text-ink-500">{hint}</span>}
          </button>
        )}
        <input ref={input} type="file" accept="image/*" capture={capture} className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
      </div>
      {(blocked || error) && <p className="text-xs font-medium text-danger">{blocked ?? error}</p>}
    </div>
  )
}

/** Upload several vehicle photos (public). */
export function MultiImageUploader({ value, onChange, max = 8 }: { value: number[]; onChange: (ids: number[]) => void; max?: number }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(0)

  const pick = async (files: FileList | null) => {
    if (!files?.length) return
    const list = Array.from(files).slice(0, max - value.length)
    setBusy(list.length)
    const ids: number[] = []
    for (const f of list) {
      try {
        ids.push((await mediaService.upload(f, 'vehicle_photo')).id)
      } catch (e) {
        toast.error(getErrorMessage(e, `Couldn't upload ${f.name}`))
      }
      setBusy((b) => b - 1)
    }
    onChange([...value, ...ids])
    if (input.current) input.current.value = ''
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {value.map((id, i) => (
          <div key={id} className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-line-200 bg-line-100">
            <img src={mediaUrl(id) ?? ''} alt={`Vehicle photo ${i + 1}`} className="h-full w-full object-cover" />
            {i === 0 && <span className="absolute top-2 left-2 rounded-md bg-ink-900/80 px-1.5 py-0.5 text-[10px] font-bold text-white">COVER</span>}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== id))} className="absolute top-2 right-2 rounded-lg bg-white/95 p-1.5 text-danger shadow-sm" aria-label="Remove photo">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        {Array.from({ length: busy }).map((_, i) => (
          <div key={`b${i}`} className="flex aspect-[4/3] items-center justify-center rounded-xl border border-line-200 bg-white">
            <Loader2 className="size-5 animate-spin text-brand" />
          </div>
        ))}
        {value.length + busy < max && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); void pick(e.dataTransfer.files) }}
            className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line-200 bg-white text-xs font-semibold text-ink-500 hover:border-brand/50 hover:text-brand"
          >
            <UploadCloud className="size-5" /> Add photos
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-ink-500">{value.length} of {max} · The first photo becomes your cover. Landscape shots in daylight work best.</p>
      <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void pick(e.target.files)} />
    </div>
  )
}
