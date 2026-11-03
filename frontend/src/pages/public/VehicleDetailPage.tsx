import { SimilarVehiclesSection } from '@/components/features/vehicles/SimilarVehiclesSection'
import { VehicleDetailSection } from '@/components/features/vehicles/VehicleDetailSection'

/** VehicleDetail page – composed only of section components. */
export default function VehicleDetailPage() {
  return (
    <>
      <VehicleDetailSection />
      <SimilarVehiclesSection />
    </>
  )
}
