import { HostCtaSection } from '@/components/features/home/HostCtaSection'
import { BecomeHostHeroSection, HostBenefitsSection, HostStepsSection } from '@/components/features/static/InfoSections'

/** BecomeHost page – composed only of section components. */
export default function BecomeHostPage() {
  return (
    <>
      <BecomeHostHeroSection />
      <HostBenefitsSection />
      <HostStepsSection />
      <HostCtaSection />
    </>
  )
}
