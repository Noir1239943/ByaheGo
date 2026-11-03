import { SectionHeading } from '@/components/common/SectionHeading'
import { RENTER_STEPS } from '@/lib/content'

export function HowItWorksSection() {
  return (
    <section className="container-page py-6">
      <SectionHeading eyebrow="How it works" title="Book your ride in three steps" />
      <ol className="mt-8 grid gap-6 md:grid-cols-3">
        {RENTER_STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink-900 text-sm font-bold text-white">{i + 1}</span>
            <div>
              <h3 className="font-bold">{s.title}</h3>
              <p className="mt-1 text-sm text-ink-500">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
