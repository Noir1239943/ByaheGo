import { HeroSection } from '@/components/features/home/HeroSection'
import { HostCtaSection } from '@/components/features/home/HostCtaSection'
import { HowItWorksSection } from '@/components/features/home/HowItWorksSection'
import { PeaceOfMindSection } from '@/components/features/home/PeaceOfMindSection'
import { TopRatedSection } from '@/components/features/home/TopRatedSection'
import { VehicleTypesSection } from '@/components/features/home/VehicleTypesSection'

/** Home page – composed only of section components. */
export default function HomePage() {
  return (
    <>
      <HeroSection />
      <VehicleTypesSection />
      <TopRatedSection />
      <PeaceOfMindSection />
      <HowItWorksSection />
      <HostCtaSection />
    </>
  )
}
