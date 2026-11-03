import { EarningsChartSection, EarningsSummarySection, PayoutsSection } from '@/components/features/host/EarningsSections'

/** HostEarnings page – composed only of section components. */
export default function HostEarningsPage() {
  return (
    <>
      <EarningsSummarySection />
      <EarningsChartSection />
      <PayoutsSection />
    </>
  )
}
