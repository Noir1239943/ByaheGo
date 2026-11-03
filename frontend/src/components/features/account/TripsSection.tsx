import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { CalendarX } from 'lucide-react'
import { PageTitle } from '@/components/common/SectionHeading'
import { ErrorState, ListSkeleton } from '@/components/common/States'
import { VehicleArt } from '@/components/common/VehicleArt'
import { Alert, Button, EmptyState, Tabs } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { bookingService } from '@/services/bookings'
import { TripCard } from './TripCard'

type Tab = 'upcoming' | 'active' | 'past' | 'cancelled'
const EMPTY: Record<Tab, [string, string]> = {
  upcoming: ['No upcoming trips yet', 'Your next adventure is a few taps away. Find a ride and it will show up here.'],
  active: ['No trips in progress', 'When you pick up a vehicle, your active trip shows up here.'],
  past: ['No past trips', 'Completed trips and their receipts will appear here.'],
  cancelled: ['No cancelled trips', 'Nice! You haven\'t cancelled anything.'],
}

export function TripsSection() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'upcoming'
  const { user } = useAuth()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['trips', tab], queryFn: () => bookingService.list(tab) })
  const c = data?.counts
  return (
    <section>
      <PageTitle title="My trips" description="Upcoming, active and past rentals." action={<Button to="/vehicles">Find a vehicle</Button>} />
      {user?.verification_status !== 'verified' && (
        <Alert tone="warning" className="mb-5" action={<Button size="sm" variant="dark" to="/verify">Verify ID</Button>}>
          Verify your driver's license so you can book self-drive trips without waiting.
        </Alert>
      )}
      <Tabs
        className="mb-5"
        value={tab}
        onChange={(t) => setParams({ tab: t })}
        tabs={[
          { value: 'upcoming', label: 'Upcoming', count: c?.upcoming },
          { value: 'active', label: 'On a trip', count: c?.active },
          { value: 'past', label: 'Past', count: c?.past },
          { value: 'cancelled', label: 'Cancelled', count: c?.cancelled },
        ]}
      />
      {isLoading ? (
        <ListSkeleton />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : data!.data.length === 0 ? (
        <div className="rounded-2xl border border-line-200 bg-white">
          <EmptyState
            art={tab === 'cancelled' ? undefined : <VehicleArt type="suv" className="mb-4 w-40" />}
            icon={<CalendarX />}
            title={EMPTY[tab][0]}
            description={EMPTY[tab][1]}
            action={tab !== 'cancelled' && <Button to="/vehicles">Browse vehicles</Button>}
          />
        </div>
      ) : (
        <div className="space-y-3">{data!.data.map((b) => <TripCard key={b.id} b={b} />)}</div>
      )}
    </section>
  )
}
