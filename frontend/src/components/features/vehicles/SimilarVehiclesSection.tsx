import { SectionHeading } from '@/components/common/SectionHeading'
import { VehicleCard } from '@/components/common/VehicleCard'
import { useVehicle } from './useVehicle'

export function SimilarVehiclesSection() {
  const { data } = useVehicle()
  if (!data || data.similar.length === 0) return null
  return (
    <section className="container-page pb-16">
      <SectionHeading title="You might also like" description="Similar vehicles from other trusted hosts." />
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {data.similar.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
      </div>
    </section>
  )
}
