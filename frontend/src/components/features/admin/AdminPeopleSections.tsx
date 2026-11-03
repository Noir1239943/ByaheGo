import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Search, ShieldOff, UserCheck, UserX, Users } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { KeyValue } from '@/components/common/InfoRow'
import { StatCard } from '@/components/common/StatCard'
import { ErrorState, ListSkeleton, PageLoader } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { TripCard } from '@/components/features/account/TripCard'
import { Alert, Avatar, Badge, Button, Card, CardHeader, EmptyState, Input, Pagination, Select, Table } from '@/components/ui'
import { useDebounce } from '@/hooks/useDebounce'
import { getErrorMessage } from '@/lib/api'
import { formatDate, peso, timeAgo } from '@/lib/format'
import { adminService, type AdminUserRow } from '@/services/admin'

export function AdminUsersSection() {
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [verification, setVerification] = useState('')
  const [page, setPage] = useState(1)
  const dq = useDebounce(q)
  const navigate = useNavigate()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'users', dq, role, status, verification, page], queryFn: () => adminService.users({ q: dq || undefined, role: role || undefined, status: status || undefined, verification: verification || undefined, page }), placeholderData: keepPreviousData })
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input placeholder="Search name, email or username" leftIcon={<Search />} value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} wrapperClassName="flex-1 min-w-56" aria-label="Search users" />
        <Select aria-label="Role" value={role} onChange={(e) => { setRole(e.target.value); setPage(1) }} options={[{ value: '', label: 'All roles' }, { value: 'renter', label: 'Renters' }, { value: 'host', label: 'Hosts' }, { value: 'admin', label: 'Admins' }]} wrapperClassName="w-40" />
        <Select aria-label="Verification" value={verification} onChange={(e) => { setVerification(e.target.value); setPage(1) }} options={[{ value: '', label: 'Any ID status' }, { value: 'verified', label: 'Verified' }, { value: 'pending', label: 'In review' }, { value: 'unverified', label: 'Not verified' }, { value: 'rejected', label: 'Rejected' }]} wrapperClassName="w-44" />
        <Select aria-label="Account status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} options={[{ value: '', label: 'Any status' }, { value: 'active', label: 'Active' }, { value: 'suspended', label: 'On hold' }]} wrapperClassName="w-40" />
      </div>
      <Card>
        {isLoading ? <div className="p-5"><ListSkeleton /></div> : error ? <ErrorState error={error} onRetry={() => void refetch()} /> : (
          <>
            <Table<AdminUserRow>
              rows={data!.data}
              rowKey={(u) => u.id}
              onRowClick={(u) => navigate(`/admin/users/${u.id}`)}
              empty={<EmptyState icon={<Users />} title="No users found" />}
              columns={[
                { key: 'user', header: 'User', cell: (u) => <div className="flex items-center gap-2.5"><Avatar initials={u.initials} size="sm" seed={u.id} /><div><p className="font-medium">{u.name}</p><p className="text-xs text-ink-500">@{u.username} · {u.email}</p></div></div> },
                { key: 'role', header: 'Role', cell: (u) => <Badge tone={u.role === 'admin' ? 'dark' : u.role === 'host' ? 'accent' : 'neutral'} className="capitalize">{u.role}</Badge> },
                { key: 'id', header: 'ID status', cell: (u) => <StatusBadge status={u.verification_status} /> },
                { key: 'activity', header: 'Activity', cell: (u) => <span className="text-ink-700">{u.bookings_count} trips{u.vehicles_count ? ` · ${u.vehicles_count} vehicles` : ''}</span> },
                { key: 'seen', header: 'Last seen', cell: (u) => <span className="text-ink-500">{u.last_login_at ? timeAgo(u.last_login_at) : '—'}</span> },
                { key: 'status', header: 'Account', cell: (u) => <StatusBadge status={u.status === 'active' ? 'live' : 'suspended'} label={u.status === 'active' ? 'Active' : 'On hold'} /> },
              ]}
            />
            <div className="border-t border-line-100 p-4"><Pagination meta={data!.meta} onChange={setPage} label="users" /></div>
          </>
        )}
      </Card>
    </section>
  )
}

export function AdminUserDetailSection() {
  const { id = '' } = useParams()
  const qc = useQueryClient()
  const [dialog, setDialog] = useState<null | 'suspend' | 'revoke'>(null)
  const { data, isLoading, error } = useQuery({ queryKey: ['admin', 'user', id], queryFn: () => adminService.user(id) })
  const done = (m: string) => { toast.success(m); setDialog(null); void qc.invalidateQueries({ queryKey: ['admin'] }) }
  const suspend = useMutation({ mutationFn: (r: string) => adminService.suspend(Number(id), r), onSuccess: () => done('Account put on hold and signed out everywhere'), onError: (e) => toast.error(getErrorMessage(e)) })
  const reinstate = useMutation({ mutationFn: () => adminService.reinstate(Number(id)), onSuccess: () => done('Account reinstated'), onError: (e) => toast.error(getErrorMessage(e)) })
  const revoke = useMutation({ mutationFn: (r: string) => adminService.revokeVerification(Number(id), r), onSuccess: () => done('Verification revoked'), onError: (e) => toast.error(getErrorMessage(e)) })
  if (isLoading) return <PageLoader />
  if (error || !data) return <ErrorState error={error} />
  const { user: u, license: l, stats, bookings } = data
  return (
    <section className="space-y-5">
      <Link to="/admin/users" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"><ArrowLeft className="size-4" /> Users</Link>
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-4">
          <Avatar initials={u.initials} size="xl" seed={u.id} />
          <div>
            <p className="text-2xl font-extrabold">{u.name}</p>
            <p className="text-sm text-ink-500">@{u.username} · {u.email} · {u.phone ?? 'no phone'}</p>
            <div className="mt-2 flex flex-wrap gap-2"><Badge tone="neutral" className="capitalize">{u.role}</Badge><StatusBadge status={u.verification_status} />{u.status === 'suspended' && <StatusBadge status="suspended" />}</div>
          </div>
        </div>
        {u.role !== 'admin' && (
          <div className="flex flex-wrap gap-2">
            {u.verification_status === 'verified' && <Button variant="secondary" icon={<ShieldOff className="size-4" />} onClick={() => setDialog('revoke')}>Revoke verification</Button>}
            {u.status === 'active' ? <Button variant="danger-outline" icon={<UserX className="size-4" />} onClick={() => setDialog('suspend')}>Suspend account</Button> : <Button icon={<UserCheck className="size-4" />} loading={reinstate.isPending} onClick={() => reinstate.mutate()}>Reinstate</Button>}
          </div>
        )}
      </Card>
      {u.status === 'suspended' && <Alert tone="danger" title="Account on hold">{u.suspended_reason}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Completed trips" value={stats.trips} />
        <StatCard label="Total spent" value={peso(stats.spent)} />
        <StatCard label="Cancellations" value={stats.cancellations} tone="accent" />
        <StatCard label="Host earnings" value={peso(stats.host_earnings)} sub={`${stats.vehicles} vehicles`} tone="info" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader title="Recent trips" />
          <div className="space-y-3 p-4">{bookings.length ? bookings.map((b) => <TripCard key={b.id} b={b} base="/admin/bookings" />) : <EmptyState title="No trips yet" />}</div>
        </Card>
        <Card className="p-5">
          <p className="font-bold">Driver's license</p>
          {l ? (
            <div className="mt-2 divide-y divide-line-100">
              <KeyValue label="Status" value={<StatusBadge status={l.status} />} />
              <KeyValue label="Number" value={l.license_number} />
              <KeyValue label="Expires" value={formatDate(l.expiry_date)} />
              <KeyValue label="Auto-check score" value={`${l.auto_score ?? '—'}%`} />
              <KeyValue label="Reviewed by" value={l.reviewer ?? '—'} />
              <Link to={`/admin/verifications/${l.id}`} className="block pt-3 text-sm font-semibold text-brand">Open submission →</Link>
            </div>
          ) : <p className="mt-2 text-sm text-ink-500">No license submitted yet.</p>}
          <p className="mt-5 font-bold">Account</p>
          <div className="mt-2 divide-y divide-line-100">
            <KeyValue label="Joined" value={formatDate(u.joined_at)} />
            <KeyValue label="Last sign-in" value={u.last_login_at ? timeAgo(u.last_login_at) : '—'} />
            <KeyValue label="Sign-in" value={[u.has_password && 'Password', u.google_linked && 'Google'].filter(Boolean).join(' + ')} />
            <KeyValue label="City" value={u.city ?? '—'} />
          </div>
        </Card>
      </div>
      <ConfirmDialog open={dialog === 'suspend'} onClose={() => setDialog(null)} title={`Suspend ${u.name}?`} description="They're signed out right away, can't book or log in, and their live listings are paused." tone="danger" confirmLabel="Suspend account" loading={suspend.isPending} reason={{ label: 'Reason (shown to the user)', required: true, placeholder: 'e.g. Submitted fake documents' }} onConfirm={(r) => suspend.mutate(r)} />
      <ConfirmDialog open={dialog === 'revoke'} onClose={() => setDialog(null)} title="Revoke license verification?" description="They'll need to verify again before booking self-drive trips." tone="danger" confirmLabel="Revoke" loading={revoke.isPending} reason={{ label: 'Reason', required: true, placeholder: 'e.g. License reported as expired' }} onConfirm={(r) => revoke.mutate(r)} />
    </section>
  )
}
