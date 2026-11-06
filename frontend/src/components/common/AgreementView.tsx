import type { AgreementSection } from '@/lib/agreement'

/** The rental agreement text, as titled sections. */
export function AgreementView({ sections }: { sections: AgreementSection[] }) {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-ink-700">
      {sections.map((s) => (
        <section key={s.title}>
          <h3 className="font-bold text-ink-900">{s.title}</h3>
          <div className="mt-1 space-y-1.5">
            {s.body.map((line, i) => <p key={i}>{line}</p>)}
          </div>
        </section>
      ))}
    </div>
  )
}
