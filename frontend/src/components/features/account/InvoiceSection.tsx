import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Printer } from 'lucide-react'
import logoMarkSrc from '@/assets/logo-mark.png'
import { ErrorState, PageLoader } from '@/components/common/States'
import { Button } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { PAYMENT_TYPE_LABEL, SUPPORT_EMAIL } from '@/lib/constants'
import { formatDate, formatDateTime, peso } from '@/lib/format'
import { adminService } from '@/services/admin'
import { bookingService } from '@/services/bookings'
import { hostService } from '@/services/host'

/** Printable summary of a booking's payments. "Save as PDF" from the print dialog. */
export function InvoiceSection() {
  const { reference = '' } = useParams()
  const { user } = useAuth()
  const { data: b, isLoading, error } = useQuery({
    queryKey: ['invoice', reference, user?.role],
    queryFn: async () => {
      try {
        return await bookingService.get(reference)
      } catch (e) {
        if (user?.role === 'admin') return adminService.booking(reference)
        if (user?.role === 'host') return hostService.booking(reference)
        throw e
      }
    },
  })
  if (isLoading) return <PageLoader />
  if (error || !b) return <div className="container-page"><ErrorState error={error} title="We couldn't find this invoice" /></div>
  const vatable = Math.round(b.total / 1.12)
  const vat = b.total - vatable
  return (
    <section className="mx-auto max-w-3xl px-4">
      <div className="no-print mb-4 flex items-center justify-between">
        <Link to={user?.role === 'admin' ? `/admin/bookings/${b.reference}` : `/account/trips/${b.reference}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"><ArrowLeft className="size-4" /> Back to trip</Link>
        <Button icon={<Printer className="size-4" />} onClick={() => window.print()}>Print / Save as PDF</Button>
      </div>
      <article className="rounded-3xl bg-white p-6 shadow-card sm:p-10 print:rounded-none print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-line-200 pb-6">
          <div className="flex items-center gap-3">
            <img src={logoMarkSrc} alt="" className="size-12" />
            <div>
              <p className="text-xl font-extrabold">Byahe<span className="text-brand">Go</span></p>
              <p className="text-xs text-ink-500">ByaheGo Philippines · Cordova, Cebu 6017</p>
              <p className="text-xs text-ink-500">{SUPPORT_EMAIL}</p>
            </div>
          </div>
          <div className="text-right text-sm">
            <p className="text-lg font-extrabold">INVOICE</p>
            <p className="text-ink-500">No. <b className="text-ink-900">{b.invoice_no}</b></p>
            <p className="text-ink-500">Date: {formatDate(b.created_at)}</p>
            <p className="text-ink-500">Booking: {b.reference}</p>
          </div>
        </header>
        <div className="grid gap-6 border-b border-line-200 py-6 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold tracking-wider text-ink-500 uppercase">Billed to</p>
            <p className="mt-1 font-semibold">{b.renter?.name ?? b.driver.name}</p>
            <p className="text-ink-500">{b.driver.email}</p>
            <p className="text-ink-500">{b.driver.phone}</p>
          </div>
          <div>
            <p className="text-xs font-bold tracking-wider text-ink-500 uppercase">Trip</p>
            <p className="mt-1 font-semibold">{b.vehicle.name}</p>
            <p className="text-ink-500">{formatDateTime(b.pickup_at)} → {formatDateTime(b.return_at)}</p>
            <p className="text-ink-500">{b.pickup_label} · Host: {b.host?.name}</p>
          </div>
        </div>
        <table className="mt-6 w-full text-sm">
          <thead><tr className="border-b border-line-200 text-left text-xs text-ink-500 uppercase"><th className="pb-2">Description</th><th className="pb-2 text-right">Amount</th></tr></thead>
          <tbody className="divide-y divide-line-100">
            <tr><td className="py-2">Vehicle rental · {peso(b.daily_rate)} × {b.days} day(s)</td><td className="py-2 text-right">{peso(b.rental_subtotal)}</td></tr>
            {b.driver_fee_total > 0 && <tr><td className="py-2">Professional driver</td><td className="py-2 text-right">{peso(b.driver_fee_total)}</td></tr>}
            <tr><td className="py-2">{b.protection.name}</td><td className="py-2 text-right">{b.protection_total ? peso(b.protection_total) : 'Included'}</td></tr>
            <tr><td className="py-2">Service fee</td><td className="py-2 text-right">{peso(b.service_fee)}</td></tr>
            {b.late_fee > 0 && <tr><td className="py-2">Late return fee ({b.late_hours} h)</td><td className="py-2 text-right">{peso(b.late_fee)}</td></tr>}
            {b.damage_charge > 0 && <tr><td className="py-2">Approved damage charge</td><td className="py-2 text-right">{peso(b.damage_charge)}</td></tr>}
          </tbody>
        </table>
        <div className="mt-4 ml-auto max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between text-ink-500"><span>VATable sales</span><span>{peso(vatable)}</span></div>
          <div className="flex justify-between text-ink-500"><span>VAT (12%)</span><span>{peso(vat)}</span></div>
          <div className="flex justify-between border-t border-line-200 pt-2 text-base font-bold"><span>Trip total</span><span>{peso(b.total + b.late_fee + b.damage_charge)}</span></div>
          <div className="flex justify-between text-ink-500"><span>Refundable deposit</span><span>{peso(b.security_deposit)}</span></div>
          {b.status === 'cancelled' && <p className="rounded-lg bg-danger-soft p-2 text-center text-xs font-semibold text-danger">Cancelled – fully refunded</p>}
        </div>
        <div className="mt-8">
          <p className="text-xs font-bold tracking-wider text-ink-500 uppercase">Payment records</p>
          <table className="mt-2 w-full text-sm">
            <thead><tr className="border-b border-line-200 text-left text-xs text-ink-500"><th className="py-2">Receipt no.</th><th className="py-2">Date</th><th className="py-2">Type</th><th className="py-2">Method</th><th className="py-2 text-right">Amount</th></tr></thead>
            <tbody className="divide-y divide-line-100">
              {b.payments.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 font-mono text-xs">{p.receipt_no}</td>
                  <td className="py-2">{formatDate(p.created_at)}</td>
                  <td className="py-2">{PAYMENT_TYPE_LABEL[p.type]}</td>
                  <td className="py-2">{p.method_label}{p.account_hint && p.method !== 'deposit' ? ` ${p.account_hint}` : ''}</td>
                  <td className="py-2 text-right font-semibold">{p.type === 'refund' ? '−' : ''}{peso(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="mt-10 border-t border-line-200 pt-4 text-xs text-ink-400">
          Thank you for riding with ByaheGo. This document is system-generated and is not a BIR-registered official receipt. Download the numbered PDF invoice for each payment from Payments & billing. Rental agreement v{b.agreement.version} accepted {formatDateTime(b.agreement.accepted_at)}.
        </footer>
      </article>
    </section>
  )
}
