import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Clock3, MapPin } from 'lucide-react'
import { RatingInline } from '@/components/common/RatingStars'
import { PageTitle } from '@/components/common/SectionHeading'
import { ErrorState, ListSkeleton } from '@/components/common/States'
import { VehicleImage } from '@/components/common/VehicleImage'
import { Button, Card, EmptyState } from '@/components/ui'
import { peso, timeAgo } from '@/lib/format'
import { accountService } from '@/services/account'
import type { VehicleCard } from '@/types'

function groupByDay(list: VehicleCard[]) {
  const today = new Date().toDateString()
  return {
    Today: list.filter((v) => v.viewed_at && new Date(v.viewed_at).toDateString() === today),
    Earlier: list.filter((v) => !v.viewed_at || new Date(v.viewed_at).toDateString() !== today),
  }
}

export function RecentlyViewedSection() {
  const qc = useQueryClient()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['recently-viewed'], queryFn: accountService.recentlyViewed })
  const clear = useMutation({ mutationFn: accountService.clearRecentlyViewed, onSuccess: () => void qc.invalidateQueries({ queryKey: ['recently-viewed'] }) })
  return (
    <section>
      <PageTitle title="Recently viewed" description="Vehicles you looked at in the last 30 days." action={data?.length ? <Button variant="ghost" size="sm" loading={clear.isPending} onClick={() => clear.mutate()}>Clear all</Button> : undefined} />
      {isLoading ? <ListSkeleton /> : error ? <ErrorState error={error} onRetry={() => void refetch()} /> : !data?.length ? (
        <Card><EmptyState icon={<Clock3 />} title="Nothing here yet" description="Vehicles you open will show up here so you can find them again." action={<Button to="/vehicles">Start browsing</Button>} /></Card>
      ) : (
        Object.entries(groupByDay(data)).filter(([, l]) => l.length).map(([label, list]) => (
          <div key={label} className="mb-6">
            <p className="mb-2 text-xs font-bold tracking-wider text-ink-500 uppercase">{label}</p>
            <Card className="divide-y divide-line-100">
              {list.map((v) => (
                <Link key={v.id} to={`/vehicles/${v.id}`} className="flex items-center gap-4 p-4 hover:bg-page">
                  <div className="h-16 w-24 shrink-0 overflow-hidden rounded-xl"><VehicleImage photo={v.photo} type={v.type} color={v.color_hex} alt={v.name} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{v.name}</p>
                    <p className="flex items-center gap-1 truncate text-xs text-ink-500"><MapPin className="size-3.5" /> {v.location_label}</p>
                    <RatingInline value={v.rating_avg} count={v.rating_count} />
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{peso(v.daily_rate)}<span className="text-xs font-normal text-ink-500">/day</span></p>
                    <p className="text-xs text-ink-400">{timeAgo(v.viewed_at)}</p>
                  </div>
                </Link>
              ))}
            </Card>
          </div>
        ))
      )}
    </section>
  )
}
