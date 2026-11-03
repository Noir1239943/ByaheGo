import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Star } from 'lucide-react'
import { RatingStars } from '@/components/common/RatingStars'
import { Avatar, Button, Modal, Pagination, Skeleton } from '@/components/ui'
import { formatDate } from '@/lib/format'
import { vehicleService } from '@/services/vehicles'
import type { Review, VehicleDetail } from '@/types'

function ReviewCard({ r }: { r: Review }) {
  return (
    <div className="rounded-2xl border border-line-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <Avatar initials={r.renter.initials} size="sm" />
        <div>
          <p className="text-sm font-semibold">{r.renter.name}</p>
          <p className="text-xs text-ink-500">{formatDate(r.created_at, { month: 'long', year: 'numeric' })}</p>
        </div>
      </div>
      <RatingStars value={r.rating} className="mt-3" />
      {r.comment && <p className="mt-2 text-sm text-ink-700">{r.comment}</p>}
    </div>
  )
}

export function ReviewsBlock({ v }: { v: VehicleDetail }) {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const all = useQuery({ queryKey: ['reviews', v.id, page], queryFn: () => vehicleService.reviews(v.id, page), enabled: open })
  const total = v.rating_count
  return (
    <div>
      <h2 className="flex items-center gap-2 text-xl font-bold">
        <Star className="size-5 fill-accent text-accent" /> {total ? `${v.rating_avg.toFixed(1)} · ${total} review${total > 1 ? 's' : ''}` : 'No reviews yet'}
      </h2>
      {total > 0 && (
        <div className="mt-4 grid max-w-md gap-1.5">
          {[5, 4, 3, 2, 1].map((s) => {
            const n = v.rating_breakdown[String(s)] ?? 0
            return (
              <div key={s} className="flex items-center gap-3 text-xs">
                <span className="w-3 text-ink-500">{s}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line-100">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(n / total) * 100}%` }} />
                </div>
                <span className="w-6 text-right text-ink-500">{n}</span>
              </div>
            )
          })}
        </div>
      )}
      {v.reviews.length > 0 ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {v.reviews.map((r) => <ReviewCard key={r.id} r={r} />)}
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink-500">Be the first to ride and review this vehicle.</p>
      )}
      {total > 4 && (
        <Button variant="secondary" className="mt-4" onClick={() => setOpen(true)}>
          Show all {total} reviews
        </Button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={`Reviews for ${v.name}`} size="lg">
        {all.isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        ) : (
          <div className="space-y-3">
            {all.data?.data.map((r) => <ReviewCard key={r.id} r={r} />)}
            {all.data && <Pagination meta={all.data.meta} onChange={setPage} label="reviews" />}
          </div>
        )}
      </Modal>
    </div>
  )
}
