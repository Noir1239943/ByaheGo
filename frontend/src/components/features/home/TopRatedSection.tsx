import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { SectionHeading } from '@/components/common/SectionHeading'
import { CardGridSkeleton, ErrorState } from '@/components/common/States'
import { VehicleCard } from '@/components/common/VehicleCard'
import { Button } from '@/components/ui'
import { vehicleService } from '@/services/vehicles'

export function TopRatedSection() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['vehicles', 'top-rated'], queryFn: () => vehicleService.list({ sort: 'rating', per_page: 4 }) })
  return (
    <section className="container-page py-14">
      <SectionHeading
        eyebrow="Popular near you"
        title="Top-rated rides in Cebu"
        action={
          <Button variant="secondary" to="/vehicles" icon={<ArrowRight className="size-4" />} className="flex-row-reverse">
            View all vehicles
          </Button>
        }
      />
      <div className="mt-8">
        {isLoading ? (
          <CardGridSkeleton count={4} className="lg:grid-cols-4 xl:grid-cols-4" />
        ) : error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {data?.data.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
          </div>
        )}
      </div>
    </section>
  )
}
