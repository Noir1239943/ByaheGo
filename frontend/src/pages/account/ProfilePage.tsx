import { ProfileSection } from '@/components/features/account/ProfileSection'
import { SecuritySection } from '@/components/features/account/SecuritySection'

/** Profile page – composed only of section components. */
export default function ProfilePage() {
  return (
    <>
      <ProfileSection />
      <SecuritySection />
    </>
  )
}
