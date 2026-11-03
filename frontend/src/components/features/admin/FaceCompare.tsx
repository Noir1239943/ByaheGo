import { useEffect, useRef, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { Skeleton } from '@/components/ui'
import { mediaService } from '@/services/media'
import type { FaceBoxReport } from '@/types'

const SIZE = 220

/** Crops the face out of a stored (private) photo, using the box the renter's device reported. */
function FaceCrop({ mediaId, box, label }: { mediaId: number | null | undefined; box: FaceBoxReport | null | undefined; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'none'>('loading')

  useEffect(() => {
    if (!mediaId || !box) return
    let cancelled = false
    let objectUrl: string | null = null
    mediaService
      .objectUrl(mediaId)
      .then((url) => {
        objectUrl = url
        const img = new Image()
        img.onload = () => {
          const ctx = canvas.current?.getContext('2d')
          if (cancelled || !ctx) return
          // Square crop around the face with some margin, clamped to the photo.
          const cx = (box.x + box.w / 2) * img.naturalWidth
          const cy = (box.y + box.h / 2) * img.naturalHeight
          const side = Math.min(Math.max(box.w * img.naturalWidth, box.h * img.naturalHeight) * 1.7, img.naturalWidth, img.naturalHeight)
          const sx = Math.min(Math.max(0, cx - side / 2), img.naturalWidth - side)
          const sy = Math.min(Math.max(0, cy - side / 2), img.naturalHeight - side)
          ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE)
          setState('ready')
        }
        img.onerror = () => !cancelled && setState('none')
        img.src = url
      })
      .catch(() => !cancelled && setState('none'))
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [mediaId, box])

  const missing = !mediaId || !box || state === 'none'
  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold">{label}</p>
      <div className="relative size-[220px] max-w-full overflow-hidden rounded-xl border border-line-200 bg-line-100">
        {missing ? (
          <div className="flex size-full flex-col items-center justify-center gap-1 px-3 text-center text-xs text-ink-500"><ImageOff className="size-5" />No face reported for this photo</div>
        ) : (
          <>
            <canvas ref={canvas} width={SIZE} height={SIZE} className="size-full" />
            {state === 'loading' && <Skeleton className="absolute inset-0" />}
          </>
        )}
      </div>
    </div>
  )
}

/** License portrait next to the live-selfie face, with the similarity the device measured. */
export function FaceCompare({ frontId, selfieId, licenseBox, selfieBox, similarity }: {
  frontId?: number | null
  selfieId?: number | null
  licenseBox?: FaceBoxReport | null
  selfieBox?: FaceBoxReport | null
  similarity?: number | null
}) {
  return (
    <div className="flex flex-wrap items-end gap-5">
      <FaceCrop mediaId={frontId} box={licenseBox} label="Face on license" />
      <FaceCrop mediaId={selfieId} box={selfieBox} label="Face in live selfie" />
      <div className="pb-2">
        <p className="text-xs text-ink-500">Device-reported match</p>
        <p className="text-3xl font-extrabold">{similarity == null ? '—' : `${Math.round(similarity * 100)}%`}</p>
        <p className="mt-1 max-w-[12rem] text-xs text-ink-500">Compare the two faces yourself – this number is a hint, not proof.</p>
      </div>
    </div>
  )
}
