import { useState } from 'react'
import { Camera, ChevronLeft, ChevronRight } from 'lucide-react'
import { VehicleImage } from '@/components/common/VehicleImage'
import { Modal } from '@/components/ui'
import type { VehicleDetail } from '@/types'
import { VehicleArt } from '@/components/common/VehicleArt'

export function VehicleGallery({ v }: { v: VehicleDetail }) {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const photos = v.photos
  // Tiles use the smaller copies; the full-size original is only fetched when the viewer opens.
  const tiles = v.photo_thumbs?.length === photos.length ? v.photo_thumbs : photos
  if (photos.length === 0) {
    return (
      <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
        <div className="relative aspect-[16/10] overflow-hidden rounded-3xl">
          <VehicleImage type={v.type} color={v.color_hex} alt={v.name} artClassName="max-w-[460px] w-[70%]" />
          <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-ink-500">Illustration – the host will share real photos at pick-up</span>
        </div>
        <div className="hidden grid-rows-2 gap-3 md:grid">
          <div className="relative flex flex-col justify-between overflow-hidden rounded-3xl bg-hero p-5 text-white">
            <span className="pointer-events-none absolute -right-10 -bottom-10 size-40 rounded-full bg-white/5" />
            <div className="flex items-center gap-2 text-sm text-white/80">
              <span className="size-4 rounded-full border-2 border-white/60" style={{ background: v.color_hex }} /> {v.color ?? 'Color as listed'}
            </div>
            <div>
              <p className="text-3xl font-extrabold">{v.rating_count ? v.rating_avg.toFixed(1) : 'New'}{v.rating_count > 0 && <span className="text-base font-semibold text-accent"> ★</span>}</p>
              <p className="text-sm text-white/70">{v.trips_count} completed trip{v.trips_count === 1 ? '' : 's'} · {v.rating_count} review{v.rating_count === 1 ? '' : 's'}</p>
            </div>
          </div>
          <div className="flex items-center justify-center rounded-3xl bg-accent-soft p-4">
            <VehicleArt type={v.type} color={v.color_hex} className="w-3/4 -scale-x-100" />
          </div>
        </div>
      </div>
    )
  }
  return (
    <>
      <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
        <button onClick={() => { setIndex(0); setOpen(true) }} className="relative aspect-[16/10] overflow-hidden rounded-3xl">
          <img src={tiles[0]} alt={v.name} className="h-full w-full object-cover" />
          <span className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-semibold shadow">
            <Camera className="size-4" /> View all {photos.length} photos
          </span>
        </button>
        <div className="hidden grid-rows-2 gap-3 md:grid">
          {[1, 2].map((i) =>
            photos[i] ? (
              <button key={i} onClick={() => { setIndex(i); setOpen(true) }} className="overflow-hidden rounded-3xl">
                <img src={tiles[i]} alt={`${v.name} photo ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
              </button>
            ) : (
              <div key={i} className="overflow-hidden rounded-3xl">
                <VehicleImage type={v.type} color={v.color_hex} alt="" />
              </div>
            ),
          )}
        </div>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={v.name} size="xl">
        <div className="relative">
          <img src={photos[index]} alt={`${v.name} photo ${index + 1}`} className="max-h-[70vh] w-full rounded-2xl object-contain" />
          {photos.length > 1 && (
            <>
              <button onClick={() => setIndex((index - 1 + photos.length) % photos.length)} className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-white p-2 shadow" aria-label="Previous photo"><ChevronLeft className="size-5" /></button>
              <button onClick={() => setIndex((index + 1) % photos.length)} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-white p-2 shadow" aria-label="Next photo"><ChevronRight className="size-5" /></button>
            </>
          )}
          <p className="mt-2 text-center text-sm text-ink-500">{index + 1} / {photos.length}</p>
        </div>
      </Modal>
    </>
  )
}
