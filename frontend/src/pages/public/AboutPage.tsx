import { HostCtaSection } from '@/components/features/home/HostCtaSection'
import { AboutStorySection, TrustSafetySection } from '@/components/features/static/InfoSections'

/** About page – composed only of section components. */
export default function AboutPage() {
  return (
    <>
      <AboutStorySection />
      <TrustSafetySection />
      <HostCtaSection />
    </>
  )
}
