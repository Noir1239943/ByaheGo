import { FaqSection } from '@/components/features/static/FaqSection'
import { HowItWorksHeroSection, RenterJourneySection, TrustSafetySection } from '@/components/features/static/InfoSections'

/** HowItWorks page – composed only of section components. */
export default function HowItWorksPage() {
  return (
    <>
      <HowItWorksHeroSection />
      <RenterJourneySection />
      <TrustSafetySection />
      <FaqSection />
    </>
  )
}
