import { useState, type ReactNode } from 'react'
import { Button, Modal, Textarea } from '@/components/ui'

type Props = {
  open: boolean
  onClose: () => void
  onConfirm: (reason: string) => unknown
  title: string
  description?: ReactNode
  confirmLabel?: string
  tone?: 'primary' | 'danger'
  loading?: boolean
  reason?: { label: string; placeholder?: string; required?: boolean }
  children?: ReactNode
}

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = 'Confirm', tone = 'primary', loading, reason, children }: Props) {
  const [text, setText] = useState('')
  const blocked = !!reason?.required && text.trim().length < 3
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Go back
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={loading} disabled={blocked} onClick={() => onConfirm(text.trim())}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
      {reason && <Textarea label={reason.label} placeholder={reason.placeholder} value={text} onChange={(e) => setText(e.target.value)} rows={3} />}
    </Modal>
  )
}
