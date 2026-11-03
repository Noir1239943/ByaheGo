import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { mediaService } from '@/services/media'

/** Loads a private document (license, OR/CR) with the signed-in user's token. */
export function ProtectedImage({ id, alt, className, onOpen, width }: { id: number | null | undefined; alt: string; className?: string; onOpen?: (url: string) => void; /** Ask for a smaller copy (for grids). */ width?: number }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!id) return
    let objectUrl: string | null = null
    let cancelled = false
    mediaService
      .objectUrl(id, width)
      .then((u) => {
        objectUrl = u
        if (!cancelled) setUrl(u)
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [id, width])
  if (!id || failed) {
    return (
      <div className={cn('flex flex-col items-center justify-center gap-1 rounded-xl bg-line-100 text-xs text-ink-500', className)}>
        <ImageOff className="size-5" /> Not provided
      </div>
    )
  }
  if (!url) return <Skeleton className={className} />
  return (
    <button type="button" onClick={() => onOpen?.(url)} className={cn('block overflow-hidden rounded-xl bg-line-100', className)}>
      <img src={url} alt={alt} className="h-full w-full object-contain" />
    </button>
  )
}
