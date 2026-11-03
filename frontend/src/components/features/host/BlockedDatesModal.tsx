import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarOff, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Input, Modal, Skeleton } from '@/components/ui'
import { getErrorMessage, getFieldErrors } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { hostService } from '@/services/host'

const today = () => new Date().toISOString().slice(0, 10)

/** Days the host switches a car off. Renters can't book them and the car drops out of date searches. */
export function BlockedDatesModal({ vehicleId, vehicleName, onClose }: { vehicleId: number | null; vehicleName: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ starts_on: '', ends_on: '', reason: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const list = useQuery({ queryKey: ['host', 'blocked-dates', vehicleId], queryFn: () => hostService.blockedDates(vehicleId!), enabled: vehicleId !== null })
  const refresh = () => qc.invalidateQueries({ queryKey: ['host', 'blocked-dates', vehicleId] })

  const add = useMutation({
    mutationFn: () => hostService.blockDates(vehicleId!, { starts_on: form.starts_on, ends_on: form.ends_on || form.starts_on, reason: form.reason || undefined }),
    onSuccess: () => { setForm({ starts_on: '', ends_on: '', reason: '' }); setErrors({}); toast.success('Dates blocked.'); void refresh() },
    onError: (err) => { setErrors(getFieldErrors(err)); toast.error(getErrorMessage(err)) },
  })
  const remove = useMutation({
    mutationFn: (id: number) => hostService.unblockDates(vehicleId!, id),
    onSuccess: () => { toast.success('Dates are open for booking again.'); void refresh() },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <Modal open={vehicleId !== null} onClose={onClose} title={`Block dates · ${vehicleName}`} description="Use this when you need the car yourself or it's in the shop. Renters can't book blocked days.">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="First day" type="date" min={today()} value={form.starts_on} onChange={(e) => setForm((f) => ({ ...f, starts_on: e.target.value, ends_on: f.ends_on < e.target.value ? e.target.value : f.ends_on }))} error={errors.starts_on} />
        <Input label="Last day" type="date" min={form.starts_on || today()} value={form.ends_on} onChange={(e) => setForm((f) => ({ ...f, ends_on: e.target.value }))} error={errors.ends_on} />
        <Input label="Reason (only you see this)" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} wrapperClassName="sm:col-span-2" placeholder="e.g. Annual service" optional />
        <Button className="sm:col-span-2" loading={add.isPending} disabled={!form.starts_on} icon={<CalendarOff className="size-4" />} onClick={() => add.mutate()}>Block these days</Button>
      </div>

      <h3 className="mt-6 text-sm font-bold">Blocked days</h3>
      {list.isLoading ? <Skeleton className="mt-2 h-12" /> : list.data && list.data.length > 0 ? (
        <ul className="mt-2 divide-y divide-line-200 rounded-xl border border-line-200">
          {list.data.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
              <span>
                <span className="font-semibold">{formatDate(d.starts_on)}{d.ends_on !== d.starts_on && ` – ${formatDate(d.ends_on)}`}</span>
                {d.reason && <span className="block text-xs text-ink-500">{d.reason}</span>}
              </span>
              <Button size="icon" variant="ghost" aria-label="Unblock these days" loading={remove.isPending && remove.variables === d.id} onClick={() => remove.mutate(d.id)}><Trash2 className="size-4 text-danger" /></Button>
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-sm text-ink-500">Nothing blocked. Your calendar is open.</p>}
    </Modal>
  )
}
