import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useLocation } from 'react-router'
import { AlertTriangle, ArrowLeft, ArrowRight, BadgeCheck, Camera, Check, CheckCircle2, Clock, CreditCard, Globe, IdCard, Lock, MinusCircle, ShieldCheck, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { ImageUploader } from '@/components/common/ImageUploader'
import { PageLoader } from '@/components/common/States'
import { Alert, Button, Card, Checkbox, Chip, Input, Stepper } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { getErrorMessage, getFieldErrors } from '@/lib/api'
import { cn } from '@/lib/cn'
import { RESTRICTION_CODES } from '@/lib/constants'
import { formatDate } from '@/lib/format'
import { analyzeBack, analyzeFront } from '@/lib/verification/analysis'
import { buildClientChecks, evaluateChecks, hardFails } from '@/lib/verification/checks'
import { releaseHuman } from '@/lib/verification/human'
import { releaseOcr } from '@/lib/verification/ocr'
import type { BackAnalysis, FrontAnalysis, SelfieAnalysis } from '@/lib/verification/types'
import { accountService } from '@/services/account'
import { LiveSelfieCapture } from './LiveSelfieCapture'

const STEPS = ['License', 'Documents', 'Details', 'Submit']
const PH_PATTERN = /^[A-Z]\d{2}-\d{2}-\d{6}$/

type Form = {
  license_type: 'ph' | 'foreign'
  front_media_id: number | null
  back_media_id: number | null
  selfie_media_id: number | null
  full_name: string
  license_number: string
  birthdate: string
  expiry_date: string
  address: string
  nationality: string
  restriction_codes: string[]
}

/** Light mirror of the server's address check, so obvious gibberish is caught before submitting. */
function addressProblem(raw: string) {
  const a = raw.trim()
  if (!a) return null
  const letters = a.replace(/[^a-z]/gi, '')
  const vowels = (letters.match(/[aeiou]/gi) ?? []).length
  const ratio = letters.length ? vowels / letters.length : 0
  const longWord = a.split(/[\s,.\-/#]+/).some((w) => w.length > 18)
  if (a.length < 8 || !/\s/.test(a) || ratio < 0.2 || ratio > 0.7 || longWord) return "That doesn't look like a real address. Enter the address printed on your license, e.g. Lahug, Cebu City."
  return null
}

function age(birthdate: string) {
  const b = new Date(birthdate)
  const n = new Date()
  let a = n.getFullYear() - b.getFullYear()
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--
  return a
}

export function VerificationSection() {
  const { user, refresh } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  const status = useQuery({ queryKey: ['verification'], queryFn: accountService.verification })
  const [step, setStep] = useState(-1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirm, setConfirm] = useState(false)
  const [front, setFront] = useState<FrontAnalysis | null>(null)
  const [back, setBack] = useState<BackAnalysis | null>(null)
  const [selfie, setSelfie] = useState<SelfieAnalysis | null>(null)
  const [form, setForm] = useState<Form>({
    license_type: 'ph', front_media_id: null, back_media_id: null, selfie_media_id: null, full_name: user?.name ?? '', license_number: '',
    birthdate: '', expiry_date: '', address: user?.city ? `${user.city}, Cebu` : '', nationality: 'Filipino', restriction_codes: ['B'],
  })
  // The face / text models are heavy; free them when the page is left.
  useEffect(() => () => { void releaseHuman(); void releaseOcr() }, [])
  const checks = useMemo(() => evaluateChecks({ front, back, selfie, licenseNumber: form.license_number, fullName: form.full_name }), [front, back, selfie, form.license_number, form.full_name])
  const failures = hardFails(checks)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = useMutation({
    mutationFn: () => accountService.submitVerification({ ...form, client_checks: buildClientChecks({ front, back, selfie, licenseNumber: form.license_number, fullName: form.full_name }), confirm_accurate: confirm }),
    onSuccess: async (res) => {
      await refresh()
      await status.refetch()
      if (res.decision === 'reject') {
        // Decided automatically: show what to retake and start over with fresh photos.
        setForm((f) => ({ ...f, front_media_id: null, back_media_id: null, selfie_media_id: null }))
        setFront(null)
        setBack(null)
        setSelfie(null)
        setConfirm(false)
        setStep(-1)
        toast.error("We couldn't verify your license. See what to retake below.")
      } else if (res.decision === 'approve') {
        setStep(-1)
        toast.success("You're verified!")
      } else {
        setStep(4)
        toast.success('Documents sent! We\'ll let you know soon.')
      }
    },
    onError: (e) => {
      setErrors(getFieldErrors(e))
      toast.error(getErrorMessage(e))
    },
  })

  if (status.isLoading) return <PageLoader />
  const current = status.data
  const license = current?.license

  if (step < 4 && current?.status === 'verified') {
    return (
      <Shell>
        <Card className="p-8 text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-success-soft"><BadgeCheck className="size-8 text-success" /></span>
          <h1 className="mt-4 text-2xl font-extrabold">You're verified</h1>
          <p className="mt-2 text-ink-500">Your driver's license {license && <>(<b>{license.license_number}</b>, valid until {formatDate(license.expiry_date)})</>} is approved. You can book any self-drive trip.</p>
          <div className="mt-6 flex justify-center gap-3">
            {from ? <Button to={from}>Continue booking</Button> : <Button to="/vehicles">Find a ride</Button>}
            <Button variant="secondary" to="/account/profile">Back to profile</Button>
          </div>
        </Card>
      </Shell>
    )
  }

  if (step === 4 || current?.status === 'pending') {
    return (
      <Shell>
        <Stepper steps={STEPS} current={4} className="mb-8" />
        <Card className="p-8 text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-brand-soft"><Check className="size-8 text-brand" strokeWidth={3} /></span>
          <h1 className="mt-4 text-2xl font-extrabold">Thanks, {user?.name.split(' ')[0]}! We're reviewing your documents</h1>
          <p className="mx-auto mt-2 max-w-md text-ink-500">Most reviews finish within 24 hours. We'll send you a notification as soon as you're approved – then you can book any self-drive trip.</p>
          <ol className="mx-auto mt-6 max-w-sm space-y-3 text-left text-sm">
            <li className="flex items-center gap-3"><span className="flex size-7 items-center justify-center rounded-full bg-brand text-white"><Check className="size-4" /></span> Documents received {license && <span className="text-ink-400">· {formatDate(license.submitted_at)}</span>}</li>
            <li className="flex items-center gap-3"><span className="flex size-7 items-center justify-center rounded-full bg-accent-soft text-warning"><Clock className="size-4" /></span> Our team checks your license and selfie</li>
            <li className="flex items-center gap-3 text-ink-400"><span className="flex size-7 items-center justify-center rounded-full border border-line-200">3</span> Approved – book your first trip</li>
          </ol>
          <p className="mt-6 text-xs text-ink-400">Tip: trips <b>with a driver</b> don't need a verified license, so you can still book one of those right away.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button to="/vehicles?rental_type=driver" variant="secondary">Browse trips with a driver</Button>
            <Button to="/account/trips">Go to my trips</Button>
          </div>
        </Card>
      </Shell>
    )
  }

  const validate = (s: number) => {
    const e: Record<string, string> = {}
    if (s === 1) {
      if (!form.front_media_id) e.front_media_id = 'Add a photo of the front of your license.'
      if (!form.back_media_id) e.back_media_id = 'Add a photo of the back of your license.'
      if (!form.selfie_media_id) e.selfie_media_id = 'Take a live selfie holding your license.'
      if (failures.length && !e.front_media_id && !e.back_media_id && !e.selfie_media_id) e.documents = failures[0].detail
    }
    if (s === 2) {
      if (form.full_name.trim().length < 3) e.full_name = 'Enter your name exactly as it appears on your license.'
      const num = form.license_number.trim().toUpperCase()
      if (!num) e.license_number = 'Enter your license number.'
      else if (form.license_type === 'ph' && !PH_PATTERN.test(num)) e.license_number = 'LTO license numbers look like N01-23-456789.'
      if (!form.birthdate) e.birthdate = 'Enter your birthdate.'
      else if (age(form.birthdate) < 21) e.birthdate = 'Drivers need to be at least 21 years old.'
      if (!form.expiry_date) e.expiry_date = 'Enter the expiry date.'
      else if (new Date(form.expiry_date) < new Date()) e.expiry_date = 'This license is expired. Please renew it with the LTO first.'
      const addr = addressProblem(form.address)
      if (addr) e.address = addr
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }
  const next = () => validate(step) && setStep(step + 1)

  if (step === -1) {
    return (
      <Shell>
        {current?.status === 'rejected' && license?.rejection_reason && (
          <Alert tone="danger" className="mb-5" icon={<XCircle />} title="We couldn't verify your last submission">{license.rejection_reason} Please try again with clear photos.</Alert>
        )}
        <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
          <Card className="p-6 sm:p-8">
            <p className="text-xs font-bold tracking-[0.14em] text-brand uppercase">Identity verification</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight">One quick check before your first trip</h1>
            <p className="mt-2 text-ink-500">We verify every driver so hosts can trust renters – and you can trust every trip. It takes about 3 minutes.</p>
            <p className="mt-6 text-sm font-semibold">What you'll need</p>
            <ul className="mt-3 space-y-3">
              {[
                { icon: IdCard, t: 'Your valid driver\'s license', s: 'Philippine LTO license or a foreign license' },
                { icon: Camera, t: 'A live selfie holding your license', s: 'Taken with your camera – we ask you to blink and turn your head' },
                { icon: Clock, t: 'About 3 minutes', s: 'Most reviews finish within 24 hours' },
              ].map((i) => (
                <li key={i.t} className="flex gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand"><i.icon className="size-4.5" /></span>
                  <span><span className="block text-sm font-semibold">{i.t}</span><span className="block text-xs text-ink-500">{i.s}</span></span>
                </li>
              ))}
            </ul>
            <Button className="mt-7" size="lg" icon={<ArrowRight className="size-4" />} onClick={() => setStep(0)}>Start verification</Button>
          </Card>
          <Card className="bg-brand-tint p-6">
            <ShieldCheck className="size-8 text-brand" />
            <h2 className="mt-3 font-bold">Your documents stay private</h2>
            <ul className="mt-3 space-y-2.5 text-sm text-ink-700">
              {['Only our verification team can see them', 'Never shown to hosts or other renters', 'Encrypted and stored securely', 'Used only to confirm who you are'].map((t) => (
                <li key={t} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={3} /> {t}</li>
              ))}
            </ul>
          </Card>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <Stepper steps={STEPS} current={step} className="mb-8" compact />
      <Card className="p-6 sm:p-8">
        <p className="text-xs font-bold tracking-[0.14em] text-brand uppercase">Step {step + 1} of 4</p>

        {step === 0 && (
          <>
            <h1 className="mt-1 text-2xl font-extrabold">Which driver's license will you use?</h1>
            <p className="mt-1 text-sm text-ink-500">Pick the license you'll show your host at pick-up.</p>
            <div className="mt-6 space-y-3">
              {[
                { v: 'ph' as const, icon: CreditCard, t: 'Philippine driver\'s license', s: 'Issued by the LTO (Land Transportation Office)' },
                { v: 'foreign' as const, icon: Globe, t: 'Foreign driver\'s license', s: 'Valid for up to 90 days after you arrive in the Philippines' },
              ].map((o) => (
                <button key={o.v} type="button" onClick={() => set('license_type', o.v)} className={cn('flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition', form.license_type === o.v ? 'border-brand bg-brand-tint ring-2 ring-brand/15' : 'border-line-200 hover:border-ink-400')}>
                  <span className="flex size-10 items-center justify-center rounded-xl bg-white text-brand shadow-sm"><o.icon className="size-5" /></span>
                  <span className="flex-1"><span className="block font-semibold">{o.t}</span><span className="block text-sm text-ink-500">{o.s}</span></span>
                  <span className={cn('size-5 rounded-full border-2', form.license_type === o.v ? 'border-[6px] border-brand' : 'border-line-200')} />
                </button>
              ))}
            </div>
            <p className="mt-4 flex items-center gap-2 text-xs text-ink-500"><Lock className="size-3.5" /> Your license must be valid for the whole trip.</p>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="mt-1 text-2xl font-extrabold">Upload your documents</h1>
            <p className="mt-1 text-sm text-ink-500">Use clear, well-lit photos where all four corners and every detail are readable. No glare or blur. Your selfie is taken live with your camera.</p>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <ImageUploader purpose="license_front" label="License – front" value={form.front_media_id} onChange={(id) => set('front_media_id', id)} error={errors.front_media_id} hint="JPG or PNG, up to 8 MB" capture="environment"
                precheck={async (file) => {
                  const a = await analyzeFront(file)
                  const probs = hardFails(evaluateChecks({ front: a, back: null, selfie: null, licenseNumber: '', fullName: '' }))
                  if (probs.length) return probs[0].detail
                  setFront(a)
                  return null
                }}
                onClear={() => { setFront(null); setSelfie(null); set('selfie_media_id', null) }} />
              <ImageUploader purpose="license_back" label="License – back" value={form.back_media_id} onChange={(id) => set('back_media_id', id)} error={errors.back_media_id} hint="Shows your restriction codes" capture="environment"
                precheck={async (file) => {
                  const a = await analyzeBack(file)
                  const probs = hardFails(evaluateChecks({ front, back: a, selfie: null, licenseNumber: '', fullName: '' })).filter((c) => c.key.startsWith('back_'))
                  if (probs.length) return probs[0].detail
                  setBack(a)
                  return null
                }}
                onClear={() => setBack(null)} />
              <div className="sm:col-span-2 sm:max-w-sm">
                <LiveSelfieCapture
                  licenseEmbedding={front?.embedding ?? null}
                  error={errors.selfie_media_id}
                  onDone={(r) => { set('selfie_media_id', r?.mediaId ?? null); setSelfie(r?.analysis ?? null) }}
                />
              </div>
            </div>
            {errors.documents && <Alert tone="danger" className="mt-4" title="Please retake a photo">{errors.documents}</Alert>}
            <PhotoChecks checks={checks.filter((c) => !['front_number', 'front_name'].includes(c.key))} />
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="mt-1 text-2xl font-extrabold">Confirm your details</h1>
            <p className="mt-1 text-sm text-ink-500">Type them exactly as printed on your license – we compare them with your photos.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Input label="Full name on license" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} error={errors.full_name} wrapperClassName="sm:col-span-2" />
              <Input label="License number" value={form.license_number} onChange={(e) => set('license_number', e.target.value.toUpperCase())} error={errors.license_number} placeholder={form.license_type === 'ph' ? 'N01-23-456789' : 'As printed'} hint={form.license_type === 'ph' ? 'Format: letter, 2 digits, 2 digits, 6 digits' : undefined} />
              <Input label="Expiry date" type="date" value={form.expiry_date} onChange={(e) => set('expiry_date', e.target.value)} error={errors.expiry_date} />
              <Input label="Birthdate" type="date" value={form.birthdate} onChange={(e) => set('birthdate', e.target.value)} error={errors.birthdate} />
              <Input label="Nationality" value={form.nationality} onChange={(e) => set('nationality', e.target.value)} />
              <Input label="Address on license" value={form.address} onChange={(e) => set('address', e.target.value)} error={errors.address} wrapperClassName="sm:col-span-2" optional />
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="mt-1 text-2xl font-extrabold">Your driver's license</h1>
            <p className="mt-1 text-sm text-ink-500">Select every restriction code on the back of your license.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {RESTRICTION_CODES.map((c) => (
                <Chip key={c.code} showCheck active={form.restriction_codes.includes(c.code)} onClick={() => set('restriction_codes', form.restriction_codes.includes(c.code) ? form.restriction_codes.filter((x) => x !== c.code) : [...form.restriction_codes, c.code])}>
                  {c.label}
                </Chip>
              ))}
            </div>
            <div className="mt-6 rounded-2xl bg-page p-4 text-sm">
              <p className="font-semibold">Review</p>
              <dl className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                <div className="flex justify-between gap-2"><dt className="text-ink-500">Name</dt><dd className="font-medium">{form.full_name}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-ink-500">License no.</dt><dd className="font-medium">{form.license_number}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-ink-500">Expires</dt><dd className="font-medium">{formatDate(form.expiry_date)}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-ink-500">Type</dt><dd className="font-medium">{form.license_type === 'ph' ? 'Philippine (LTO)' : 'Foreign'}</dd></div>
              </dl>
            </div>
            <Checkbox className="mt-5" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} error={errors.confirm_accurate} label="I confirm these details are accurate and the license belongs to me." description="Submitting false documents gets your account permanently suspended." />
          </>
        )}

        <div className="mt-8 flex items-center justify-between border-t border-line-100 pt-5">
          <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={() => setStep(step - 1)}>Back</Button>
          {step < 3 ? (
            <Button onClick={next}>Continue</Button>
          ) : (
            <Button loading={submit.isPending} disabled={!confirm} onClick={() => submit.mutate()}>Submit for review</Button>
          )}
        </div>
      </Card>
    </Shell>
  )
}

function PhotoChecks({ checks }: { checks: ReturnType<typeof evaluateChecks> }) {
  if (checks.every((c) => c.status === 'not_checked')) return null
  const icon = {
    pass: <CheckCircle2 className="size-4 text-success" />,
    warn: <AlertTriangle className="size-4 text-warning" />,
    fail: <XCircle className="size-4 text-danger" />,
    not_checked: <MinusCircle className="size-4 text-ink-400" />,
  }
  return (
    <div className="mt-5 rounded-2xl bg-page p-4">
      <p className="text-sm font-semibold">Photo checks</p>
      <p className="text-xs text-ink-500">Done on your device – your photos aren't sent anywhere for these checks.</p>
      <ul className="mt-3 space-y-2">
        {checks.map((c) => (
          <li key={c.key} className="flex gap-2.5">
            <span className="mt-0.5">{icon[c.status]}</span>
            <span className="text-sm"><span className="font-medium">{c.label}</span>{c.status !== 'not_checked' && <span className="block text-xs text-ink-500">{c.detail}</span>}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <section className="container-page max-w-3xl py-8 sm:py-12">{children}</section>
}
