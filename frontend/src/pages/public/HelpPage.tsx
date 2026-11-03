import { ContactSection } from '@/components/features/static/ContactSection'
import { FaqSection } from '@/components/features/static/FaqSection'
import { HelpHeroSection } from '@/components/features/static/InfoSections'

/** Help page – composed only of section components. */
export default function HelpPage() {
  return (
    <>
      <HelpHeroSection />
      <FaqSection />
      <ContactSection />
    </>
  )
}
