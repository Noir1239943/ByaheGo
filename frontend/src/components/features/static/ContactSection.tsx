import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle2, Mail, Phone, Siren } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card, Input, Select, Textarea } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { getErrorMessage, getFieldErrors } from '@/lib/api'
import { SUPPORT_EMAIL, SUPPORT_PHONE } from '@/lib/constants'
import { accountService } from '@/services/account'

export function ContactSection() {
  const { user } = useAuth()
  const [form, setForm] = useState({ name: user?.name ?? '', email: user?.email ?? '', topic: 'booking', booking_reference: '', message: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const send = useMutation({
    mutationFn: () => accountService.contact(form),
    onSuccess: (r) => toast.success(r.message),
    onError: (e) => { setErrors(getFieldErrors(e)); toast.error(getErrorMessage(e)) },
  })
  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value })
  const submit = (e: FormEvent) => { e.preventDefault(); send.mutate() }

  return (
    <section id="contact" className="container-page scroll-mt-20 pb-16">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4">
          <h2 className="text-2xl font-extrabold tracking-tight">Still need help?</h2>
          <p className="text-ink-500">Our Cebu-based team replies within a few hours, every day.</p>
          {[
            { icon: Siren, t: 'Call us', s: SUPPORT_PHONE, href: 'tel:+63328882924' },
            { icon: Mail, t: 'Email us', s: SUPPORT_EMAIL, href: `mailto:${SUPPORT_EMAIL}` },
            { icon: Phone, t: 'Text or Viber', s: '0917 888 2924', href: 'sms:+639178882924' },
          ].map((c) => (
            <a key={c.t} href={c.href} className="flex items-center gap-4 rounded-2xl border border-line-200 bg-white p-4 hover:border-brand/40">
              <span className="flex size-10 items-center justify-center rounded-xl bg-brand-tint text-brand"><c.icon className="size-5" /></span>
              <span><span className="block font-semibold">{c.t}</span><span className="block text-sm text-ink-500">{c.s}</span></span>
            </a>
          ))}
        </div>
        <Card className="p-6">
          {send.isSuccess ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="mx-auto size-12 text-success" />
              <p className="mt-3 text-lg font-bold">Message sent</p>
              <p className="text-ink-500">We'll reply to {form.email} soon.</p>
              <Button variant="secondary" className="mt-4" onClick={() => { send.reset(); setForm({ ...form, message: '' }) }}>Send another</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
              <Input label="Your name" value={form.name} onChange={f('name')} error={errors.name} />
              <Input label="Email" type="email" value={form.email} onChange={f('email')} error={errors.email} />
              <Select label="Topic" value={form.topic} onChange={f('topic')} options={[
                { value: 'booking', label: 'A booking' }, { value: 'payment', label: 'Payments' }, { value: 'refund', label: 'Refunds' },
                { value: 'verification', label: 'ID verification' }, { value: 'hosting', label: 'Hosting' }, { value: 'safety', label: 'Safety concern' }, { value: 'other', label: 'Something else' },
              ]} />
              <Input label="Booking reference" value={form.booking_reference} onChange={f('booking_reference')} placeholder="BG-20481" optional />
              <Textarea label="How can we help?" rows={5} value={form.message} onChange={f('message')} error={errors.message} wrapperClassName="sm:col-span-2" />
              <Button type="submit" loading={send.isPending} className="sm:col-span-2 sm:justify-self-start">Send message</Button>
            </form>
          )}
        </Card>
      </div>
    </section>
  )
}
