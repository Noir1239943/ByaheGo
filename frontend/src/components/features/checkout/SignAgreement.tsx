import { useCallback, useEffect, useRef } from 'react'
import { CheckCircle2, FileText, PenLine } from 'lucide-react'
import { AgreementView } from '@/components/common/AgreementView'
import { Alert, Checkbox, Input, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { namesMatch, type AgreementPreview } from '@/lib/agreement'
import { formatDateTime } from '@/lib/format'

export type Signing = { readToEnd: boolean; agree: boolean; name: string }

type Props = {
  agreement: AgreementPreview | undefined
  loading: boolean
  error: string | null
  signing: Signing
  onChange: (next: Signing) => void
  errors: Record<string, string>
}

/**
 * Step 1 read the whole agreement (the box has to be scrolled to the end), step 2 tick "I agree",
 * step 3 type the full name exactly as on the verified license. Nothing here can be skipped.
 */
export function SignAgreement({ agreement, loading, error, signing, onChange, errors }: Props) {
  const box = useRef<HTMLDivElement>(null)

  const check = useCallback(() => {
    const el = box.current
    if (!el || signing.readToEnd) return
    // A box that fits without scrolling counts as read.
    if (el.scrollHeight - el.scrollTop - el.clientHeight <= 12) onChange({ ...signing, readToEnd: true })
  }, [signing, onChange])

  useEffect(() => { if (agreement) check() }, [agreement, check])

  // A different agreement (new dates or plan) has to be read again.
  const hash = agreement?.hash
  const lastHash = useRef(hash)
  useEffect(() => {
    if (lastHash.current !== hash) {
      lastHash.current = hash
      if (box.current) box.current.scrollTop = 0
      onChange({ readToEnd: false, agree: false, name: signing.name })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash])

  const nameOk = !!agreement && namesMatch(signing.name, agreement.signer_name)

  return (
    <div>
      <h2 className="flex items-center gap-2 font-bold"><FileText className="size-4.5 text-brand" /> Rental agreement</h2>
      <p className="mt-1 text-sm text-ink-500">Read it to the end, then sign. This is the contract between you and the host.</p>

      {error ? (
        <Alert tone="danger" className="mt-3" title="We couldn't load the agreement">{error}</Alert>
      ) : loading || !agreement ? (
        <Skeleton className="mt-3 h-64" />
      ) : (
        <>
          <p className="mt-3 rounded-xl bg-brand-tint px-3 py-2 text-sm font-semibold text-brand-dark">Free cancellation until {formatDateTime(agreement.free_cancellation_until)}</p>
          <div
            ref={box}
            onScroll={check}
            tabIndex={0}
            aria-label="Rental agreement text"
            className={cn('mt-3 max-h-72 overflow-y-auto rounded-xl border bg-white p-4', signing.readToEnd ? 'border-success' : 'border-line-200')}
          >
            <AgreementView sections={agreement.sections} />
          </div>
          <p className={cn('mt-1.5 flex items-center gap-1.5 text-xs', signing.readToEnd ? 'font-semibold text-success' : 'text-ink-500')}>
            {signing.readToEnd ? <><CheckCircle2 className="size-3.5" /> You've reached the end.</> : 'Scroll to the end of the agreement to continue. Version ' + agreement.version + '.'}
          </p>

          <Checkbox
            className="mt-4"
            checked={signing.agree}
            disabled={!signing.readToEnd}
            onChange={(e) => onChange({ ...signing, agree: e.target.checked })}
            error={errors.agree_terms ?? errors.agreement_read_to_end}
            label="I have read the whole agreement and I agree to it."
          />

          <div className={cn('mt-4 transition', !signing.agree && 'pointer-events-none opacity-50')}>
            <Input
              label="Sign with your full name"
              leftIcon={<PenLine className="size-4" />}
              value={signing.name}
              onChange={(e) => onChange({ ...signing, name: e.target.value })}
              disabled={!signing.agree}
              autoComplete="off"
              placeholder={agreement.signer_name}
              error={errors.signature_name ?? errors.agreement}
              hint={nameOk ? 'Matches your verified name ✓' : `Type your name exactly as on your verified license: ${agreement.signer_name}`}
            />
          </div>
        </>
      )}
    </div>
  )
}
