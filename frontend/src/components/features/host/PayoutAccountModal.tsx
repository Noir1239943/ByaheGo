import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button, Input, Modal, Select } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { getErrorMessage, getFieldErrors } from '@/lib/api'
import { accountService } from '@/services/account'

export function PayoutAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, setUser } = useAuth()
  const qc = useQueryClient()
  const [form, setForm] = useState({ payout_method: user?.payout?.method ?? 'gcash', payout_account_name: user?.payout?.account_name ?? user?.name ?? '', payout_account_number: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    try {
      const u = await accountService.payout(form)
      setUser(u)
      toast.success('Payout account saved')
      void qc.invalidateQueries({ queryKey: ['host'] })
      onClose()
    } catch (e) {
      setErrors(getFieldErrors(e))
      toast.error(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal open={open} onClose={onClose} title="Payout account" description="Where we send your earnings, 3 days after each trip." size="sm" footer={<Button loading={busy} onClick={() => void save()}>Save</Button>}>
      <div className="space-y-4">
        <Select label="Method" value={form.payout_method} onChange={(e) => setForm({ ...form, payout_method: e.target.value as 'gcash' })} options={[{ value: 'gcash', label: 'GCash' }, { value: 'maya', label: 'Maya' }, { value: 'bank', label: 'Bank transfer' }]} />
        <Input label="Account name" value={form.payout_account_name} onChange={(e) => setForm({ ...form, payout_account_name: e.target.value })} error={errors.payout_account_name} />
        <Input label={form.payout_method === 'bank' ? 'Account number' : 'Mobile number'} value={form.payout_account_number} onChange={(e) => setForm({ ...form, payout_account_number: e.target.value })} error={errors.payout_account_number} placeholder={user?.payout?.account_masked ?? ''} />
      </div>
    </Modal>
  )
}
