import { useEffect, useRef, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { mediaService } from '@/services/media'

/** Loads a private document (license, OR/CR) with the signed-in user's token. */
export function ProtectedImage({ id, alt, className, onOpen, width }: { id: number | null | undefined; alt: string; className?: string; onOpen?: (url: string) => void; /** Ask for a smaller copy (for grids). */ width?: number }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  // A photo is only fetched once it is close to the screen, so a page with a dozen photos asks for the visible ones first.
  const holder = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = holder.current
    if (near || !el) return
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true)
      return
    }
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: '300px' })
    io.observe(el)
    return () => io.disconnect()
  }, [near])
  useEffect(() => {
    if (!id || !near) return
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
  }, [id, width, near])
  if (!id || failed) {
    return (
      <div className={cn('flex flex-col items-center justify-center gap-1 rounded-xl bg-line-100 text-xs text-ink-500', className)}>
        <ImageOff className="size-5" /> Not provided
      </div>
    )
  }
  if (!url) return <div ref={holder} className={className}><Skeleton className="h-full w-full" /></div>
  return (
    <button type="button" onClick={() => onOpen?.(url)} className={cn('block overflow-hidden rounded-xl bg-line-100', className)}>
      <img src={url} alt={alt} className="h-full w-full object-contain" />
    </button>
  )
}
