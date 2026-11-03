import type { ReactNode } from 'react'

export function PageHero({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <section className="bg-hero text-white">
      <div className="container-page py-14 sm:py-16">
        {eyebrow && <p className="text-xs font-bold tracking-[0.14em] text-accent uppercase">{eyebrow}</p>}
        <h1 className="mt-2 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-5xl">{title}</h1>
        {description && <p className="mt-4 max-w-2xl text-white/75 sm:text-lg">{description}</p>}
        {children}
      </div>
    </section>
  )
}
