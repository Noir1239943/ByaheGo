import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BellRing, Heart } from 'lucide-react'
import { toast } from 'sonner'
import { PageTitle } from '@/components/common/SectionHeading'
import { CardGridSkeleton, ErrorState } from '@/components/common/States'
import { VehicleCard } from '@/components/common/VehicleCard'
import { Button, Card, EmptyState, Switch } from '@/components/ui'
import { getErrorMessage } from '@/lib/api'
import { accountService } from '@/services/account'

export function SavedVehiclesSection() {
  const qc = useQueryClient()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['favorites'], queryFn: accountService.favorites })
  const alert = useMutation({
    mutationFn: (id: number) => accountService.toggleAlert(id),
    onSuccess: (r) => { toast.success(r.price_alert ? 'We\'ll tell you when the price drops' : 'Price alert turned off'); void qc.invalidateQueries({ queryKey: ['favorites'] }) },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  return (
    <section>
      <PageTitle title="Saved vehicles" description={data ? `${data.length} saved` : 'Vehicles you\'ve hearted'} />
      {isLoading ? (
        <CardGridSkeleton count={3} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : !data?.length ? (
        <Card><EmptyState icon={<Heart />} title="No saved vehicles yet" description="Tap the heart on any vehicle to save it for later." action={<Button to="/vehicles">Browse vehicles</Button>} /></Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((v) => (
            <div key={v.id}>
              <VehicleCard vehicle={v} />
              <div className="mt-2 flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs shadow-card">
                <span className="flex items-center gap-1.5 font-medium text-ink-700"><BellRing className="size-3.5 text-brand" /> Price drop alerts</span>
                <Switch checked={!!v.price_alert} onChange={() => alert.mutate(v.id)} label="Price drop alerts" />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
