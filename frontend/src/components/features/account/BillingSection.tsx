import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { ArrowDownLeft, CreditCard, ReceiptText, ShieldCheck, Wallet } from 'lucide-react'
import { PageTitle } from '@/components/common/SectionHeading'
import { StatCard } from '@/components/common/StatCard'
import { ErrorState, ListSkeleton } from '@/components/common/States'
import { Alert, Badge, Card, EmptyState, Table, Tabs } from '@/components/ui'
import { PAYMENT_TYPE_LABEL } from '@/lib/constants'
import { formatDate, peso } from '@/lib/format'
import { accountService } from '@/services/account'
import type { Payment } from '@/types'

export function BillingSection() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['billing'], queryFn: accountService.billing })
  const [tab, setTab] = useState<'all' | 'payments' | 'refunds' | 'fees'>('all')
  if (isLoading) return <ListSkeleton />
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />
  const s = data.summary
  const rows = data.data.filter((p) => tab === 'all' || (tab === 'payments' ? ['charge', 'balance'].includes(p.type) : tab === 'refunds' ? p.type === 'refund' : ['late_fee', 'damage'].includes(p.type)))
  return (
    <section>
      <PageTitle title="Payments & billing" description="Every payment, refund and fee, with official receipts you can download." />
      {s.balance_due > 0 && <Alert tone="danger" className="mb-5" title={`You have ${peso(s.balance_due)} due`}>Open the trip in My trips to settle it.</Alert>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<CreditCard />} label="Total paid" value={peso(s.total_paid)} />
        <StatCard icon={<ArrowDownLeft />} label="Refunded to you" value={peso(s.total_refunded)} tone="info" />
        <StatCard icon={<Wallet />} label="Fees & charges" value={peso(s.fees_and_charges)} sub="Late returns or damage" tone="accent" />
        <StatCard icon={<ShieldCheck />} label="Deposits on hold" value={peso(s.deposits_on_hold)} sub="Returned after each trip" />
      </div>
      <Card className="mt-5">
        <div className="px-5 pt-4"><Tabs value={tab} onChange={setTab} tabs={[{ value: 'all', label: 'All' }, { value: 'payments', label: 'Payments' }, { value: 'refunds', label: 'Refunds' }, { value: 'fees', label: 'Fees' }]} /></div>
        <Table<Payment>
          rows={rows}
          rowKey={(p) => p.id}
          empty={<EmptyState icon={<ReceiptText />} title="No transactions here yet" />}
          columns={[
            { key: 'date', header: 'Date', cell: (p) => <span className="whitespace-nowrap text-ink-500">{formatDate(p.created_at)}</span> },
            { key: 'desc', header: 'Description', cell: (p) => <><p className="font-semibold">{PAYMENT_TYPE_LABEL[p.type]}</p><p className="max-w-xs truncate text-xs text-ink-500">{p.vehicle_name ?? p.description}</p></> },
            { key: 'trip', header: 'Trip', cell: (p) => p.booking_reference && <Link to={`/account/trips/${p.booking_reference}`} className="font-medium text-brand hover:underline">{p.booking_reference}</Link> },
            { key: 'method', header: 'Method', cell: (p) => <span className="text-ink-700">{p.method_label}{p.account_hint && p.method !== 'deposit' && <span className="block text-xs text-ink-400">{p.account_hint}</span>}</span> },
            { key: 'amount', header: 'Amount', headerClassName: 'text-right', className: 'text-right', cell: (p) => <span className={p.type === 'refund' ? 'font-bold text-success' : 'font-bold'}>{p.type === 'refund' ? '+' : ''}{peso(p.amount)}</span> },
            { key: 'or', header: 'Receipt', cell: (p) => p.booking_reference && <Link to={`/invoice/${p.booking_reference}`} className="inline-flex"><Badge tone="neutral">{p.receipt_no}</Badge></Link> },
          ]}
        />
      </Card>
    </section>
  )
}
