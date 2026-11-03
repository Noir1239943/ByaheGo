import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import { AlertTriangle, ArrowLeft, BadgeCheck, Car, CheckCircle2, Gavel, MinusCircle, Search, ShieldAlert, Store, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { KeyValue } from '@/components/common/InfoRow'
import { ProtectedImage } from '@/components/common/ProtectedImage'
import { ErrorState, ListSkeleton, PageLoader } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { VehicleImage } from '@/components/common/VehicleImage'
import { Alert, Avatar, Badge, Button, Card, CardBody, CardHeader, Checkbox, EmptyState, Input, Modal, Pagination, Table, Tabs, Textarea } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { useDebounce } from '@/hooks/useDebounce'
import { getErrorMessage } from '@/lib/api'
import { cn } from '@/lib/cn'
import { INCIDENT_LABELS, PAYOUT_LABELS, typeLabel } from '@/lib/constants'
import { capitalize, formatDate, formatDateTime, peso, timeAgo } from '@/lib/format'
import { adminService } from '@/services/admin'
import type { AutoLabel, HostApplication, HostVehicle, Incident, License } from '@/types'
import { FaceCompare } from './FaceCompare'

function ScoreBadge({ score, label }: { score: number; label?: AutoLabel | null }) {
  const kind = label ?? (score >= 90 ? 'good' : 'check') // licenses scored before labels existed
  const view = {
    reject: { tone: 'danger', text: 'Likely fake — reject' },
    incomplete: { tone: 'warning', text: 'Not fully checked' },
    check: { tone: 'warning', text: 'check closely' },
    good: { tone: 'success', text: 'looks good' },
  } as const
  return <Badge tone={view[kind].tone}>{score}% {view[kind].text}</Badge>
}

const CHECK_ICON = {
  pass: <CheckCircle2 className="size-4.5 text-success" />,
  warn: <AlertTriangle className="size-4.5 text-warning" />,
  fail: <XCircle className="size-4.5 text-danger" />,
  not_checked: <MinusCircle className="size-4.5 text-ink-400" />,
}
const CHECK_STATE = { pass: 'Pass', warn: 'Warning', fail: 'Fail', not_checked: 'Not checked' }

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'danger' | 'warning' }) {
  return (
    <div className="rounded-xl bg-page p-3">
      <p className="text-xs text-ink-500">{label}</p>
      <p className={cn('text-lg font-extrabold', tone === 'success' && 'text-success', tone === 'danger' && 'text-danger', tone === 'warning' && 'text-warning')}>{value}</p>
    </div>
  )
}

const pctOf = (v: number | null | undefined) => (v == null ? 'Not checked' : `${Math.round(v * 100)}%`)

// ---------------- Verifications ----------------

export function AdminVerificationsSection() {
  const [status, setStatus] = useState('pending')
  const [page, setPage] = useState(1)
  const navigate = useNavigate()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'verifications', status, page], queryFn: () => adminService.verifications(status.startsWith('auto_') ? { decision: status, page } : { status, page }), placeholderData: keepPreviousData })
  return (
    <section>
      <Alert tone="brand" className="mb-4" title="How verification works">Every submission runs through automatic checks: license format, expiry, age, name match, address, near-duplicate photos and reuse across accounts, plus face, liveness and text checks done on the renter's device. Checks that didn't run are shown as "Not checked", never as passed. Critical failures are rejected automatically (with advice for the renter), clean submissions are approved automatically only when that switch is on, and everything else waits here under "Needs review". Auto-decided submissions have their own tabs and can be overridden by a super admin.</Alert>
      <Tabs className="mb-4" variant="pill" value={status} onChange={(s) => { setStatus(s); setPage(1) }} tabs={[{ value: 'pending', label: 'Needs review' }, { value: 'auto_approved', label: 'Auto-approved' }, { value: 'auto_rejected', label: 'Auto-rejected' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }, { value: 'all', label: 'All' }]} />
      <Card>
        {isLoading ? <div className="p-5"><ListSkeleton /></div> : error ? <ErrorState error={error} onRetry={() => void refetch()} /> : (
          <>
            <Table<License>
              rows={data!.data}
              rowKey={(l) => l.id}
              onRowClick={(l) => navigate(`/admin/verifications/${l.id}`)}
              empty={<EmptyState icon={<BadgeCheck />} title="All caught up" description="No licenses waiting for review." />}
              columns={[
                { key: 'user', header: 'Renter', cell: (l) => <div className="flex items-center gap-2.5"><Avatar initials={l.user?.initials ?? '?'} size="sm" seed={l.user?.id} /><div><p className="font-medium">{l.user?.name}</p><p className="text-xs text-ink-500">{l.user?.email}</p></div></div> },
                { key: 'license', header: 'License', cell: (l) => <><p className="font-mono text-xs">{l.license_number}</p><p className="text-xs text-ink-500">{l.license_type === 'ph' ? 'Philippine (LTO)' : 'Foreign'}</p></> },
                { key: 'score', header: 'Automatic checks', cell: (l) => <ScoreBadge score={l.auto_score ?? 0} label={l.auto_label} /> },
                ...(status.startsWith('auto_') ? [{ key: 'reason', header: 'Reason', cell: (l: License) => <div className="max-w-sm"><p className="line-clamp-2 text-xs text-ink-700">{l.auto_decision_reason}</p>{l.override && <Badge tone="warning" className="mt-1">Overridden by {l.override.by}</Badge>}</div> }] : []),
                { key: 'submitted', header: 'Submitted', cell: (l) => <span className="text-ink-500">{timeAgo(l.submitted_at)}</span> },
                { key: 'status', header: 'Status', cell: (l) => <StatusBadge status={l.status} /> },
              ]}
            />
            <div className="border-t border-line-100 p-4"><Pagination meta={data!.meta} onChange={setPage} label="submissions" /></div>
          </>
        )}
      </Card>
    </section>
  )
}

export function AdminVerificationDetailSection() {
  const { id = '' } = useParams()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const [rejectOpen, setRejectOpen] = useState(false)
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [zoom, setZoom] = useState<string | null>(null)
  const { data: l, isLoading, error } = useQuery({ queryKey: ['admin', 'verification', id], queryFn: () => adminService.verification(id) })
  const done = (m: string) => { toast.success(m); void qc.invalidateQueries({ queryKey: ['admin'] }); navigate('/admin/verifications') }
  const approve = useMutation({ mutationFn: () => adminService.approveVerification(Number(id)), onSuccess: () => done('Approved – the renter can now book self-drive trips.'), onError: (e) => toast.error(getErrorMessage(e)) })
  const reject = useMutation({ mutationFn: (reason: string) => adminService.rejectVerification(Number(id), reason), onSuccess: () => done('Rejected – the renter was asked to resubmit.'), onError: (e) => toast.error(getErrorMessage(e)) })
  const override = useMutation({
    mutationFn: ({ decision, note }: { decision: 'approve' | 'reject'; note: string }) => adminService.overrideVerification(Number(id), decision, note),
    onSuccess: () => { toast.success('Decision changed and logged.'); setOverrideOpen(false); void qc.invalidateQueries({ queryKey: ['admin'] }) },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  if (isLoading) return <PageLoader />
  if (error || !l) return <ErrorState error={error} />
  const autoDecided = l.auto_decision === 'approve' || l.auto_decision === 'reject'
  const flipTo = l.status === 'approved' ? 'reject' : 'approve'
  const cc = l.client_checks
  const rows = new Map((l.auto_checks ?? []).map((c) => [c.key, c]))
  const state = (key: string) => rows.get(key)?.result ?? 'not_checked'
  const tone = (key: string) => ({ pass: 'success', warn: 'warning', fail: 'danger', not_checked: undefined } as const)[state(key)]
  const hasFaces = !!(cc?.faces.license || cc?.faces.selfie)
  return (
    <section className="space-y-5">
      <Link to="/admin/verifications" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"><ArrowLeft className="size-4" /> ID verifications</Link>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar initials={l.user?.initials ?? '?'} size="lg" seed={l.user?.id} />
          <div><p className="text-xl font-extrabold">{l.user?.name}</p><p className="text-sm text-ink-500">@{l.user?.username} · joined {formatDate(l.user?.joined_at)} · submitted {timeAgo(l.submitted_at)}</p></div>
        </div>
        {l.status === 'pending' ? (
          <div className="flex gap-2">
            <Button variant="danger-outline" onClick={() => setRejectOpen(true)}>Reject</Button>
            <Button icon={<BadgeCheck className="size-4" />} loading={approve.isPending} onClick={() => approve.mutate()}>Approve</Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <StatusBadge status={l.status} />
            {autoDecided && me?.is_super_admin && <Button size="sm" variant="secondary" onClick={() => setOverrideOpen(true)}>Override: {flipTo === 'approve' ? 'approve' : 'reject'}</Button>}
          </div>
        )}
      </div>
      {autoDecided && (
        <Alert tone={l.status === 'approved' ? 'success' : 'danger'} title={l.decision_source === 'admin' ? `Automatic ${l.auto_decision === 'approve' ? 'approval' : 'rejection'} overridden` : l.auto_decision === 'approve' ? 'Approved automatically' : 'Rejected automatically'}>
          {l.auto_decision_reason}
          {l.override && <span className="mt-1 block">Overridden by {l.override.by} {timeAgo(l.override.at)}: {l.override.note}</span>}
          {!me?.is_super_admin && <span className="mt-1 block text-xs">Only a super admin can override this decision.</span>}
        </Alert>
      )}
      {l.rejection_reason && !autoDecided && <Alert tone="danger">Reason: {l.rejection_reason}</Alert>}
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
        <Card>
          <CardHeader title="Documents" description="Click a photo to zoom in" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            {[['Front', l.front_media_id], ['Back', l.back_media_id], ['Selfie with license', l.selfie_media_id]].map(([label, mid]) => (
              <div key={label as string} className={label === 'Selfie with license' ? 'sm:col-span-2 sm:max-w-sm' : ''}>
                <p className="mb-1.5 text-sm font-semibold">{label}</p>
                <ProtectedImage id={mid as number} alt={label as string} className="aspect-[16/10] w-full border border-line-200" onOpen={setZoom} />
              </div>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Face check" description="Cropped from the stored photos. Judge the match yourself." />
          <CardBody>
            {hasFaces ? (
              <FaceCompare frontId={l.front_media_id} selfieId={l.selfie_media_id} licenseBox={cc?.faces.license} selfieBox={cc?.faces.selfie} similarity={cc?.face_similarity} />
            ) : (
              <p className="text-sm text-ink-500">The renter's device didn't report any face positions, so no face crops are available. Compare the photos above by eye.</p>
            )}
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Metric label="Face match" value={pctOf(cc?.face_similarity)} tone={tone('face_match')} />
              <Metric label="Liveness" value={pctOf(cc?.liveness)} tone={tone('selfie_liveness')} />
              <Metric label="Anti-spoof" value={pctOf(cc?.antispoof)} tone={tone('selfie_antispoof')} />
            </div>
            <p className="mt-4 text-xs font-semibold text-ink-700">License wording found by text reading (OCR)</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {cc?.ocr_keyword_hits.length ? cc.ocr_keyword_hits.map((k) => <Badge key={k} tone="success">{k}</Badge>) : <span className="text-xs text-ink-500">{cc ? 'None found' : 'Not checked'}</span>}
            </div>
            <details className="mt-4 rounded-xl border border-line-200 p-3">
              <summary className="cursor-pointer text-sm font-semibold">Text read from license</summary>
              {cc && (cc.ocr_text.front || cc.ocr_text.back) ? (
                <div className="mt-3 space-y-3">
                  {([['Front', cc.ocr_text.front], ['Back', cc.ocr_text.back]] as const).map(([name, text]) => (
                    <div key={name}>
                      <p className="text-xs font-semibold text-ink-500">{name} <Badge tone="neutral" className="ml-1">device-reported</Badge></p>
                      <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-page p-3 font-mono text-xs whitespace-pre-wrap text-ink-700">{text || 'No text read.'}</pre>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-2 text-xs text-ink-500">No text was reported by the renter's device.</p>}
            </details>
          </CardBody>
        </Card>
        </div>
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-center justify-between"><p className="font-bold">Automatic checks</p><ScoreBadge score={l.auto_score ?? 0} label={l.auto_label} /></div>
            <p className="mt-1 text-xs text-ink-500">Tagged <b>device-reported</b> means the renter's browser said so. Treat it as supporting evidence, not proof.</p>
            <ul className="mt-3 space-y-3">
              {l.auto_checks?.map((c) => (
                <li key={c.key} className="flex gap-2.5">
                  <span className="mt-0.5" title={CHECK_STATE[c.result]}>{CHECK_ICON[c.result]}</span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">{c.label}
                      {c.source === 'device' && <Badge tone="neutral" className="px-1.5 py-0.5 text-[10px] font-medium">device-reported</Badge>}
                      {c.result === 'not_checked' && <Badge tone="neutral" className="px-1.5 py-0.5 text-[10px] font-medium">not checked</Badge>}
                    </span>
                    <span className="block text-xs text-ink-500">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          {!!l.decisions?.length && (
            <Card className="p-5">
              <p className="font-bold">Decision log</p>
              <p className="mt-1 text-xs text-ink-500">Every automatic decision and override, kept for audit.</p>
              <ul className="mt-3 space-y-3">
                {l.decisions.map((d) => (
                  <li key={d.id} className="rounded-xl bg-page p-3 text-xs">
                    <p className="font-semibold">{d.event === 'override' ? `Override by ${d.actor ?? 'admin'}` : 'Automatic decision'}: {d.outcome === 'review' ? 'needs review' : d.outcome} <span className="font-normal text-ink-500">· {formatDateTime(d.created_at)}</span></p>
                    <p className="mt-1 text-ink-700">{d.reason}</p>
                    {d.event === 'auto_decision' && (
                      <p className="mt-1 text-ink-500">
                        Score {d.scores.score ?? '—'}% · face {pctOf(d.scores.face_similarity)} · liveness {pctOf(d.scores.liveness)} · anti-spoof {pctOf(d.scores.antispoof)} · auto-approve {d.settings.auto_approve ? 'on' : 'off'}
                        {d.triggers.length > 0 && <> · triggers: {d.triggers.join(', ')}</>}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card className="p-5">
            <p className="font-bold">Details entered</p>
            <div className="mt-2 divide-y divide-line-100">
              <KeyValue label="Name on license" value={l.full_name} />
              <KeyValue label="License no." value={l.license_number} />
              <KeyValue label="Birthdate" value={formatDate(l.birthdate)} />
              <KeyValue label="Expiry" value={formatDate(l.expiry_date)} />
              <KeyValue label="Restriction codes" value={l.restriction_codes.join(', ') || '—'} />
              <KeyValue label="Nationality" value={l.nationality ?? '—'} />
              <KeyValue label="Address" value={l.address ?? '—'} />
            </div>
          </Card>
        </div>
      </div>
      <ConfirmDialog open={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject this license?" description="The renter will see your reason and can upload new photos." tone="danger" confirmLabel="Reject" loading={reject.isPending} reason={{ label: 'Reason', placeholder: 'e.g. The selfie is blurry – please retake it in good light.', required: true }} onConfirm={(r) => reject.mutate(r)} />
      <ConfirmDialog open={overrideOpen} onClose={() => setOverrideOpen(false)} title={flipTo === 'approve' ? 'Override: approve this license?' : 'Override: reject this license?'} description={flipTo === 'approve' ? 'The renter becomes verified. Your note is saved in the audit log.' : 'The renter sees your note and can resubmit. It is saved in the audit log.'} tone={flipTo === 'approve' ? 'primary' : 'danger'} confirmLabel={flipTo === 'approve' ? 'Approve' : 'Reject'} loading={override.isPending} reason={{ label: 'Note', placeholder: flipTo === 'approve' ? 'e.g. Verified in person with the original license.' : 'e.g. Photos look edited – please retake them.', required: true }} onConfirm={(note) => override.mutate({ decision: flipTo, note })} />
      <Modal open={!!zoom} onClose={() => setZoom(null)} title="Document" size="xl">{zoom && <img src={zoom} alt="Document" className="w-full rounded-xl" />}</Modal>
    </section>
  )
}

// ---------------- Host applications ----------------

export function AdminHostApplicationsSection() {
  const [status, setStatus] = useState('pending')
  const [rejecting, setRejecting] = useState<HostApplication | null>(null)
  const qc = useQueryClient()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'host-apps', status], queryFn: () => adminService.hostApplications({ status }) })
  const approve = useMutation({ mutationFn: (id: number) => adminService.approveHost(id), onSuccess: () => { toast.success('Approved – they can now list vehicles.'); void qc.invalidateQueries({ queryKey: ['admin'] }) }, onError: (e) => toast.error(getErrorMessage(e)) })
  const reject = useMutation({ mutationFn: ({ id, notes }: { id: number; notes: string }) => adminService.rejectHost(id, notes), onSuccess: () => { toast.success('Application declined'); setRejecting(null); void qc.invalidateQueries({ queryKey: ['admin'] }) }, onError: (e) => toast.error(getErrorMessage(e)) })
  return (
    <section>
      <Tabs className="mb-4" variant="pill" value={status} onChange={setStatus} tabs={[{ value: 'pending', label: 'Waiting' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Declined' }, { value: 'all', label: 'All' }]} />
      {isLoading ? <ListSkeleton /> : error ? <ErrorState error={error} onRetry={() => void refetch()} /> : data!.data.length === 0 ? (
        <Card><EmptyState icon={<Store />} title="No applications here" description="New host applications show up here for review." /></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data!.data.map((a) => (
            <Card key={a.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3"><Avatar initials={a.user?.initials ?? '?'} seed={a.user?.id} /><div><p className="font-bold">{a.full_name}</p><p className="text-xs text-ink-500">{a.user?.email} · {timeAgo(a.submitted_at)}</p></div></div>
                <StatusBadge status={a.status} />
              </div>
              <div className="mt-4 divide-y divide-line-100">
                <KeyValue label="City" value={a.city} />
                <KeyValue label="Phone" value={a.phone} />
                <KeyValue label="Vehicles" value={`${a.vehicle_count} · ${a.vehicle_types.map(typeLabel).join(', ')}`} />
                {a.business_name && <KeyValue label="Business" value={a.business_name} />}
                <KeyValue label="Payouts" value={`${PAYOUT_LABELS[a.payout_method]}${a.payout_bank ? ` (${a.payout_bank})` : ''} ${a.payout_account_masked} (${a.payout_account_name})`} />
                {a.address && <KeyValue label="Address" value={a.address} />}
                <KeyValue label="Renter ID" value={<StatusBadge status={a.user?.verification_status ?? 'unverified'} />} />
              </div>
              {a.notes && <p className="mt-3 rounded-xl bg-page p-3 text-sm text-ink-700">“{a.notes}”</p>}
              {a.admin_notes && <p className="mt-3 text-xs text-ink-500">Admin note: {a.admin_notes}</p>}
              {a.status === 'pending' && (
                <div className="mt-4 flex gap-2">
                  <Button size="sm" loading={approve.isPending && approve.variables === a.id} onClick={() => approve.mutate(a.id)}>Approve host</Button>
                  <Button size="sm" variant="danger-outline" onClick={() => setRejecting(a)}>Decline</Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      <ConfirmDialog open={!!rejecting} onClose={() => setRejecting(null)} title="Decline application?" tone="danger" confirmLabel="Decline" loading={reject.isPending} reason={{ label: 'Tell the applicant why', required: true, placeholder: 'e.g. Please verify your driver\'s license first, then apply again.' }} onConfirm={(notes) => rejecting && reject.mutate({ id: rejecting.id, notes })} />
    </section>
  )
}

// ---------------- Listings ----------------

export function AdminListingsSection() {
  const [status, setStatus] = useState('pending')
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const dq = useDebounce(q)
  const navigate = useNavigate()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'listings', status, page, dq], queryFn: () => adminService.listings({ status, page, q: dq || undefined }), placeholderData: keepPreviousData })
  const c = data?.counts ?? {}
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs variant="pill" value={status} onChange={(s) => { setStatus(s); setPage(1) }} tabs={[{ value: 'pending', label: 'In review', count: c.pending ?? 0 }, { value: 'live', label: 'Live', count: c.live ?? 0 }, { value: 'paused', label: 'Paused', count: c.paused ?? 0 }, { value: 'rejected', label: 'Needs changes', count: c.rejected ?? 0 }, { value: 'all', label: 'All' }]} />
        <Input placeholder="Search make, model or plate" leftIcon={<Search />} value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-64" aria-label="Search listings" />
      </div>
      <Card>
        {isLoading ? <div className="p-5"><ListSkeleton /></div> : error ? <ErrorState error={error} onRetry={() => void refetch()} /> : (
          <>
            <Table<HostVehicle>
              rows={data!.data}
              rowKey={(v) => v.id}
              onRowClick={(v) => navigate(`/admin/listings/${v.id}`)}
              empty={<EmptyState icon={<Car />} title="No listings here" />}
              columns={[
                { key: 'v', header: 'Vehicle', cell: (v) => <div className="flex items-center gap-3"><div className="h-10 w-14 shrink-0 overflow-hidden rounded-lg"><VehicleImage photo={v.photo} type={v.type} color={v.color_hex} alt="" /></div><div><p className="font-semibold">{v.name}</p><p className="text-xs text-ink-500">{v.plate_number} · {typeLabel(v.type)}</p></div></div> },
                { key: 'host', header: 'Host', cell: (v) => v.host_name },
                { key: 'loc', header: 'Pick-up', cell: (v) => <span className="text-ink-700">{v.location_label}</span> },
                { key: 'rate', header: 'Rate', cell: (v) => `${peso(v.daily_rate)}/day` },
                { key: 'sub', header: 'Submitted', cell: (v) => <span className="text-ink-500">{v.submitted_at ? timeAgo(v.submitted_at) : '—'}</span> },
                { key: 'status', header: 'Status', cell: (v) => <StatusBadge status={v.status} /> },
              ]}
            />
            <div className="border-t border-line-100 p-4"><Pagination meta={data!.meta} onChange={setPage} label="listings" /></div>
          </>
        )}
      </Card>
    </section>
  )
}

export function AdminListingDetailSection() {
  const { id = '' } = useParams()
  const qc = useQueryClient()
  const [rejectOpen, setRejectOpen] = useState(false)
  const [zoom, setZoom] = useState<string | null>(null)
  const { data: v, isLoading, error } = useQuery({ queryKey: ['admin', 'listing', id], queryFn: () => adminService.listing(id) })
  const done = (m: string) => { toast.success(m); void qc.invalidateQueries({ queryKey: ['admin'] }) }
  const approve = useMutation({ mutationFn: () => adminService.approveListing(Number(id)), onSuccess: () => done('Listing approved and live'), onError: (e) => toast.error(getErrorMessage(e)) })
  const reject = useMutation({ mutationFn: (r: string) => adminService.rejectListing(Number(id), r), onSuccess: () => { done('Sent back to the host'); setRejectOpen(false) }, onError: (e) => toast.error(getErrorMessage(e)) })
  const pause = useMutation({ mutationFn: () => adminService.suspendListing(Number(id)), onSuccess: () => done('Listing paused'), onError: (e) => toast.error(getErrorMessage(e)) })
  if (isLoading) return <PageLoader />
  if (error || !v) return <ErrorState error={error} />
  const checks = [
    { ok: v.photos.length >= 3, t: 'At least 3 photos' },
    { ok: !!v.plate_number, t: 'Plate number provided' },
    { ok: !!v.or_media_id && !!v.cr_media_id, t: 'OR and CR uploaded' },
    { ok: !!v.ctpl_media_id && !!v.ctpl_expiry && v.ctpl_expiry > new Date().toISOString().slice(0, 10), t: v.ctpl_expiry ? `CTPL insurance valid until ${formatDate(v.ctpl_expiry)}` : 'CTPL insurance uploaded' },
    { ok: v.daily_rate >= 300, t: 'Daily rate set' },
    { ok: !!v.pickup.label, t: 'Pick-up location set' },
  ]
  return (
    <section className="space-y-5">
      <Link to="/admin/listings" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"><ArrowLeft className="size-4" /> Listings</Link>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xl font-extrabold">{v.name}</p><p className="text-sm text-ink-500">by {v.host_name} · {v.plate_number}</p></div>
        <div className="flex items-center gap-2">
          <StatusBadge status={v.status} />
          {v.status === 'pending' && <><Button variant="danger-outline" onClick={() => setRejectOpen(true)}>Request changes</Button><Button loading={approve.isPending} onClick={() => approve.mutate()}>Approve listing</Button></>}
          {v.status === 'live' && <Button variant="secondary" loading={pause.isPending} onClick={() => pause.mutate()}>Pause listing</Button>}
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="grid gap-2 p-2 sm:grid-cols-3">
              {(v.photos.length ? v.photos : [null]).slice(0, 6).map((p, i) => (
                <div key={i} className="aspect-[4/3] overflow-hidden rounded-xl"><VehicleImage photo={p} type={v.type} color={v.color_hex} alt="" /></div>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title="Registration papers" description="Check that the plate and owner match the host" />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <div><p className="mb-1.5 text-sm font-semibold">Official Receipt (OR)</p><ProtectedImage id={v.or_media_id} alt="OR" className="aspect-[16/10] w-full border border-line-200" onOpen={setZoom} /></div>
              <div><p className="mb-1.5 text-sm font-semibold">Certificate of Registration (CR)</p><ProtectedImage id={v.cr_media_id} alt="CR" className="aspect-[16/10] w-full border border-line-200" onOpen={setZoom} /></div>
              <div><p className="mb-1.5 text-sm font-semibold">CTPL insurance</p><ProtectedImage id={v.ctpl_media_id} alt="CTPL" className="aspect-[16/10] w-full border border-line-200" onOpen={setZoom} /></div>
            </CardBody>
          </Card>
          <Card className="p-5"><p className="font-bold">Description</p><p className="mt-2 text-sm text-ink-700">{v.description || '—'}</p><p className="mt-3 text-sm text-ink-500">Features: {v.features.join(', ') || '—'}</p></Card>
        </div>
        <div className="space-y-5">
          <Card className="p-5">
            <p className="font-bold">Listing checklist</p>
            <ul className="mt-3 space-y-2">{checks.map((c) => <li key={c.t} className="flex items-center gap-2 text-sm">{c.ok ? <CheckCircle2 className="size-4.5 text-success" /> : <XCircle className="size-4.5 text-danger" />}{c.t}</li>)}</ul>
          </Card>
          <Card className="p-5">
            <p className="font-bold">Details</p>
            <div className="mt-2 divide-y divide-line-100">
              <KeyValue label="Type" value={`${typeLabel(v.type)} · ${v.seats} seats`} />
              <KeyValue label="Transmission · fuel" value={`${capitalize(v.transmission)} · ${capitalize(v.fuel)}`} />
              <KeyValue label="Daily rate" value={peso(v.daily_rate)} />
              <KeyValue label="Deposit · late fee" value={`${peso(v.security_deposit)} · ${peso(v.late_fee_per_hour)}/h`} />
              <KeyValue label="Driver" value={v.with_driver_available ? `${peso(v.driver_fee_per_day)}/day` : 'No'} />
              <KeyValue label="Pick-up" value={v.pickup.label} />
              <KeyValue label="Trips · earnings" value={`${v.bookings_count} · ${peso(v.earnings)}`} />
            </div>
          </Card>
          {v.rejection_reason && <Alert tone="danger">Last request: {v.rejection_reason}</Alert>}
        </div>
      </div>
      <ConfirmDialog open={rejectOpen} onClose={() => setRejectOpen(false)} title="Request changes" description="The host gets your note and can resubmit." confirmLabel="Send to host" tone="danger" loading={reject.isPending} reason={{ label: 'What needs fixing?', required: true, placeholder: 'e.g. The CR photo is cut off – please upload the full page.' }} onConfirm={(r) => reject.mutate(r)} />
      <Modal open={!!zoom} onClose={() => setZoom(null)} title="Document" size="xl">{zoom && <img src={zoom} alt="Document" className="w-full rounded-xl" />}</Modal>
    </section>
  )
}

// ---------------- Disputes ----------------

export function AdminDisputesSection() {
  const [status, setStatus] = useState('open')
  const [active, setActive] = useState<Incident | null>(null)
  const [form, setForm] = useState({ action: 'charge' as 'charge' | 'dismiss', amount: '', notes: '', suspend_renter: false })
  const qc = useQueryClient()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'disputes', status], queryFn: () => adminService.disputes({ status }) })
  const resolve = useMutation({
    mutationFn: () => adminService.resolveDispute(active!.id, { action: form.action, amount: form.action === 'charge' ? Number(form.amount || 0) : undefined, notes: form.notes, suspend_renter: form.suspend_renter }),
    onSuccess: () => { toast.success('Decision saved. Both sides were notified.'); setActive(null); void qc.invalidateQueries({ queryKey: ['admin'] }) },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const open = (i: Incident) => {
    const cap = ['theft', 'missing_parts'].includes(i.type) ? i.amount_claimed : Math.min(i.amount_claimed, i.booking?.liability_cap ?? i.amount_claimed)
    setForm({ action: 'charge', amount: String(cap), notes: '', suspend_renter: i.type === 'theft' })
    setActive(i)
  }
  return (
    <section>
      <Tabs className="mb-4" variant="pill" value={status} onChange={setStatus} tabs={[{ value: 'open', label: 'Open' }, { value: 'resolved', label: 'Resolved' }, { value: 'dismissed', label: 'Dismissed' }, { value: 'all', label: 'All' }]} />
      {isLoading ? <ListSkeleton /> : error ? <ErrorState error={error} onRetry={() => void refetch()} /> : data!.data.length === 0 ? (
        <Card><EmptyState icon={<Gavel />} title="No disputes" description="Damage claims, theft and trip incidents show up here." /></Card>
      ) : (
        <div className="space-y-3">
          {data!.data.map((i) => (
            <Card key={i.id} className={cn('p-5', i.type === 'theft' && i.status === 'open' && 'border-danger/40')}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {i.type === 'theft' ? <ShieldAlert className="size-5 text-danger" /> : <Gavel className="size-5 text-warning" />}
                    <p className="font-bold">{INCIDENT_LABELS[i.type] ?? i.type}</p>
                    <StatusBadge status={i.status} />
                  </div>
                  <p className="mt-1 text-sm text-ink-500">
                    <Link to={`/admin/bookings/${i.booking?.reference}`} className="font-semibold text-brand">{i.booking?.reference}</Link> · {i.booking?.vehicle_name} · reported by {i.reporter_role} {i.reporter?.name} · {timeAgo(i.created_at)}
                  </p>
                </div>
                {i.status === 'open' && <Button size="sm" onClick={() => open(i)}>Review & decide</Button>}
              </div>
              <p className="mt-3 text-sm text-ink-700">{i.description}</p>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-500">
                <span>Claimed: <b className="text-ink-900">{peso(i.amount_claimed)}</b></span>
                <span>Renter: <b className="text-ink-900">{i.booking?.renter.name}</b></span>
                <span>Plan: <b className="text-ink-900">{capitalize(i.booking?.protection_plan)} (cap {peso(i.booking?.liability_cap ?? 0)})</b></span>
                <span>Deposit: <b className="text-ink-900">{peso(i.booking?.security_deposit ?? 0)}</b></span>
                {i.status !== 'open' && <span>Approved: <b className="text-ink-900">{peso(i.amount_approved)}</b></span>}
              </div>
              {i.resolution_notes && <p className="mt-3 rounded-xl bg-page p-3 text-xs text-ink-700">Decision: {i.resolution_notes} {i.resolved_at && `(${formatDateTime(i.resolved_at)})`}</p>}
            </Card>
          ))}
        </div>
      )}
      <Modal open={!!active} onClose={() => setActive(null)} title="Decide on this claim" description={active ? `${INCIDENT_LABELS[active.type]} · ${active.booking?.reference}` : ''} footer={<Button loading={resolve.isPending} onClick={() => resolve.mutate()}>{form.action === 'charge' ? `Approve ${peso(Number(form.amount || 0))}` : 'Dismiss claim'}</Button>}>
        {active && (
          <div className="space-y-4">
            <Alert tone="info">
              {['theft', 'missing_parts'].includes(active.type)
                ? 'Theft and missing parts are not covered by protection – the renter is fully liable.'
                : `Accidental damage is capped at ${peso(active.booking?.liability_cap ?? 0)} by the renter's ${capitalize(active.booking?.protection_plan)} plan.`}
              {' '}Approved amounts come out of the {peso(active.booking?.security_deposit ?? 0)} deposit first; the rest is billed to the renter.
            </Alert>
            <div className="grid grid-cols-2 gap-2">
              {(['charge', 'dismiss'] as const).map((a) => (
                <button key={a} onClick={() => setForm({ ...form, action: a })} className={cn('rounded-xl border p-3 text-sm font-semibold', form.action === a ? 'border-brand bg-brand-tint' : 'border-line-200')}>{a === 'charge' ? 'Approve charge' : 'Dismiss'}</button>
              ))}
            </div>
            {form.action === 'charge' && <Input label="Amount to charge the renter" type="number" leftIcon={<span className="text-xs font-bold">₱</span>} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} hint={`Host claimed ${peso(active.amount_claimed)}`} />}
            <Textarea label="Decision notes (shared with both sides)" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <Checkbox checked={form.suspend_renter} onChange={(e) => setForm({ ...form, suspend_renter: e.target.checked })} label="Suspend the renter's account" description="Use for theft, fraud or serious misuse. They're signed out immediately." />
          </div>
        )}
      </Modal>
    </section>
  )
}
