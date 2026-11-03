import { HostSetupSection, HostStatsSection, HostTodaySection, HostWelcomeSection } from '@/components/features/host/HostDashboardSections'

/** HostDashboard page – composed only of section components. */
export default function HostDashboardPage() {
  return (
    <>
      <HostWelcomeSection />
      <HostSetupSection />
      <HostStatsSection />
      <HostTodaySection />
    </>
  )
}
