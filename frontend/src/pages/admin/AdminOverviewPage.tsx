import { AdminGreetingSection, AdminKpiSection, AdminRecentBookingsSection, AdminRevenueSection } from '@/components/features/admin/AdminOverviewSections'

/** AdminOverview page – composed only of section components. */
export default function AdminOverviewPage() {
  return (
    <>
      <AdminGreetingSection />
      <AdminKpiSection />
      <AdminRevenueSection />
      <AdminRecentBookingsSection />
    </>
  )
}
