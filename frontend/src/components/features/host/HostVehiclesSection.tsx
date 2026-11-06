import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Camera, CalendarClock, CalendarOff, Eye, Pause, Pencil, Play, Plus, Search, Send, Tag, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { ErrorState, ListSkeleton } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { VehicleArt } from '@/components/common/VehicleArt'
import { VehicleImage } from '@/components/common/VehicleImage'
import { Alert, Button, Card, Input, Tabs } from '@/components/ui'
import { BlockedDatesModal } from './BlockedDatesModal'
import { useDebounce } from '@/hooks/useDebounce'
import { getErrorMessage } from '@/lib/api'
import { formatDate, peso } from '@/lib/format'
import { hostService } from '@/services/host'
import type { HostVehicle } from '@/types'

type Tab = 'all' | 'live' | 'pending' | 'draft' | 'paused' | 'rejected'

export function HostVehiclesSection() {
  const [tab, setTab] = useState<Tab>('all')
  const [q, setQ] = useState('')
  const dq = useDebounce(q)
  const qc = useQueryClient()
  const [toDelete, setToDelete] = useState<HostVehicle | null>(null)
  const [blocking, setBlocking] = useState<HostVehicle | null>(null)
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['host', 'vehicles', tab, dq], queryFn: () => hostService.vehicles({ status: tab === 'all' ? undefined : tab, q: dq || undefined }) })

  const act = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: 'pause' | 'resume' | 'submit' | 'delete' }) => {
      if (action === 'pause') await hostService.pauseVehicle(id)
      else if (action === 'resume') await hostService.resumeVehicle(id)
      else if (action === 'submit') await hostService.submitVehicle(id)
      else await hostService.deleteVehicle(id)
    },
    onSuccess: (_d, { action }) => {
      toast.success({ pause: 'Listing paused – renters can\'t book it for now.', resume: 'Listing is live again.', submit: 'Sent for review. We usually approve within 24 hours.', delete: 'Vehicle deleted.' }[action])
      setToDelete(null)
      void qc.invalidateQueries({ queryKey: ['host'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const c = data?.counts ?? {}
  const total = Object.values(c).reduce((a, b) => a + b, 0)

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-full overflow-x-auto"><Tabs variant="pill" value={tab} onChange={setTab} tabs={[
          { value: 'all', label: 'All', count: total }, { value: 'live', label: 'Live', count: c.live ?? 0 }, { value: 'pending', label: 'In review', count: c.pending ?? 0 },
          { value: 'draft', label: 'Drafts', count: c.draft ?? 0 }, { value: 'paused', label: 'Paused', count: c.paused ?? 0 }, { value: 'rejected', label: 'Needs changes', count: c.rejected ?? 0 },
        ]} /></div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Input placeholder="Search vehicles" leftIcon={<Search />} value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-full sm:w-56" aria-label="Search vehicles" />
          <Button size="sm" to="/host/vehicles/new" icon={<Plus className="size-4" />}>Add vehicle</Button>
        </div>
      </div>

      {(c.pending ?? 0) > 0 && tab === 'all' && <Alert tone="warning" className="mb-4">You have {c.pending} listing(s) in review. Most listings are reviewed within 24 hours.</Alert>}

      {isLoading ? <ListSkeleton /> : error ? <ErrorState error={error} onRetry={() => void refetch()} /> : total === 0 ? (
        <>
          <Card className="px-6 py-12 text-center">
            <div className="mx-auto flex max-w-xs items-end justify-center gap-2"><VehicleArt type="sedan" color="#FFB224" className="w-28" /><VehicleArt type="suv" color="#0D7C6B" className="w-32" /></div>
            <h3 className="mt-4 text-xl font-bold">List your first vehicle</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">Add photos, set your daily rate and choose where renters pick it up. Most listings are reviewed within 24 hours.</p>
            <div className="mt-5 flex justify-center gap-3"><Button to="/host/vehicles/new" icon={<Plus className="size-4" />}>Add vehicle</Button><Button variant="secondary" to="/become-a-host">See hosting tips</Button></div>
          </Card>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {[
              { icon: Camera, t: 'Great photos win bookings', s: 'Shoot in daylight and include every side plus the interior.' },
              { icon: Tag, t: 'Price it to get started', s: 'A slightly lower rate helps you land your first reviews.' },
              { icon: CalendarClock, t: 'Keep your calendar fresh', s: 'Pause the listing when you need the vehicle yourself.' },
            ].map((t) => (
              <Card key={t.t} className="p-5"><t.icon className="size-5 text-brand" /><p className="mt-3 font-semibold">{t.t}</p><p className="mt-1 text-sm text-ink-500">{t.s}</p></Card>
            ))}
          </div>
        </>
      ) : data!.data.length === 0 ? (
        <Card className="p-10 text-center text-sm text-ink-500">No vehicles in this list.</Card>
      ) : (
        <div className="space-y-3">
          {data!.data.map((v) => (
            <Card key={v.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <div className="h-28 overflow-hidden rounded-xl sm:h-20 sm:w-32 sm:shrink-0"><VehicleImage photo={v.photo} type={v.type} color={v.color_hex} alt={v.name} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><StatusBadge status={v.status} /><span className="text-xs text-ink-400">{v.plate_number ?? 'No plate yet'}</span></div>
                <p className="mt-1 truncate font-bold">{v.name || 'Untitled vehicle'}</p>
                <p className="text-xs text-ink-500">{v.daily_rate ? `${peso(v.daily_rate)}/day` : 'No price yet'} · {v.location_label || 'No pick-up spot yet'} · {v.bookings_count} trips · {peso(v.earnings)} earned</p>
                {v.status === 'rejected' && v.rejection_reason && <p className="mt-1 text-xs font-semibold text-danger">Our team: {v.rejection_reason}</p>}
                {v.status === 'pending' && <p className="mt-1 text-xs text-warning">Submitted {formatDate(v.submitted_at)} – in review</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {v.status === 'live' && <Button size="sm" variant="ghost" icon={<Eye className="size-4" />} to={`/vehicles/${v.id}`}>View</Button>}
                <Button size="sm" variant="secondary" icon={<Pencil className="size-4" />} to={`/host/vehicles/${v.id}/edit`}>Edit</Button>
                {['live', 'paused'].includes(v.status) && <Button size="sm" variant="secondary" icon={<CalendarOff className="size-4" />} onClick={() => setBlocking(v)}>Block dates</Button>}
                {v.status === 'live' && <Button size="sm" variant="secondary" icon={<Pause className="size-4" />} onClick={() => act.mutate({ id: v.id, action: 'pause' })}>Pause</Button>}
                {v.status === 'paused' && <Button size="sm" icon={<Play className="size-4" />} onClick={() => act.mutate({ id: v.id, action: 'resume' })}>Resume</Button>}
                {['draft', 'rejected'].includes(v.status) && <Button size="sm" icon={<Send className="size-4" />} onClick={() => act.mutate({ id: v.id, action: 'submit' })}>Submit</Button>}
                {v.bookings_count === 0 && <Button size="icon" variant="ghost" aria-label="Delete vehicle" onClick={() => setToDelete(v)}><Trash2 className="size-4 text-danger" /></Button>}
              </div>
            </Card>
          ))}
        </div>
      )}
      <BlockedDatesModal vehicleId={blocking?.id ?? null} vehicleName={blocking?.name ?? ''} onClose={() => setBlocking(null)} />
      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} title={`Delete ${toDelete?.name ?? 'this vehicle'}?`} description="This can't be undone." tone="danger" confirmLabel="Delete" loading={act.isPending} onConfirm={() => toDelete && act.mutate({ id: toDelete.id, action: 'delete' })} />
      <p className="mt-6 text-center text-xs text-ink-400">Need help with a listing? <Link to="/help#contact" className="font-semibold text-brand">Contact host support</Link></p>
    </section>
  )
}
