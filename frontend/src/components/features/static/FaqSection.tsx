import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { SectionHeading } from '@/components/common/SectionHeading'
import { cn } from '@/lib/cn'
import { FAQS } from '@/lib/content'

export function FaqSection({ limit }: { limit?: number }) {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section className="container-page py-14">
      <SectionHeading eyebrow="FAQ" title="Questions renters ask" />
      <div className="mt-6 divide-y divide-line-200 rounded-2xl border border-line-200 bg-white">
        {FAQS.slice(0, limit).map(([q, a], i) => (
          <div key={q}>
            <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold" aria-expanded={open === i}>
              {q}
              <ChevronDown className={cn('size-5 shrink-0 text-ink-400 transition', open === i && 'rotate-180')} />
            </button>
            {open === i && <p className="animate-fade-in px-5 pb-5 text-sm leading-relaxed text-ink-700">{a}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}
