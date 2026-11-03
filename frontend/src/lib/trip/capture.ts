/** Everything the guided camera does to a photo in the browser: shrink it, burn the date/time and booking reference into it, and read the GPS. */

export const MAX_SIDE = 1600
export const JPEG_QUALITY = 0.8

export type CaptureMeta = { live: boolean; device_time: string; lat: number | null; lng: number | null }

/** Draws a small label (date/time + booking reference) into the bottom-left corner. The text is part of the pixels. */
function burnWatermark(ctx: CanvasRenderingContext2D, w: number, h: number, text: string) {
  const size = Math.max(14, Math.round(Math.max(w, h) / 60))
  ctx.font = `600 ${size}px system-ui, sans-serif`
  ctx.textBaseline = 'bottom'
  const pad = Math.round(size * 0.6)
  const width = ctx.measureText(text).width
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(0, h - size - pad * 2, width + pad * 2, size + pad * 2)
  ctx.fillStyle = '#fff'
  ctx.fillText(text, pad, h - pad)
}

export function watermarkText(reference: string, label: string, when = new Date()) {
  return `${reference} · ${label} · ${when.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'medium' })}`
}

/** Scales any image or video frame to at most MAX_SIDE on its long edge, stamps it, and returns a JPEG. */
export async function toStampedJpeg(source: CanvasImageSource, width: number, height: number, stamp: string): Promise<Blob> {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height))
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser cannot process photos.')
  ctx.drawImage(source, 0, 0, w, h)
  burnWatermark(ctx, w, h, stamp)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
  if (!blob) throw new Error('We could not save that photo. Please try again.')
  return blob
}

export async function fileToStampedJpeg(file: File, stamp: string): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  try {
    return await toStampedJpeg(bitmap, bitmap.width, bitmap.height, stamp)
  } finally {
    bitmap.close()
  }
}

/** One GPS reading, or null when the person says no or it takes too long. Never blocks taking a photo. */
export function readPosition(timeoutMs = 4000): Promise<{ lat: number; lng: number } | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null)
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs + 500)
    navigator.geolocation.getCurrentPosition(
      (p) => { clearTimeout(timer); resolve({ lat: Number(p.coords.latitude.toFixed(6)), lng: Number(p.coords.longitude.toFixed(6)) }) },
      () => { clearTimeout(timer); resolve(null) },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    )
  })
}

export const FUEL_STEPS = [
  { value: 0, label: 'E' },
  { value: 25, label: '¼' },
  { value: 50, label: '½' },
  { value: 75, label: '¾' },
  { value: 100, label: 'F' },
] as const

export const fuelLabel = (level: number) => FUEL_STEPS.find((s) => s.value === level)?.label ?? `${level}%`
