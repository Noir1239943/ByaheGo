import { Link } from 'react-router'
import { BadgeCheck, CarFront, ClipboardCheck, FileCheck2, HeartHandshake, Leaf, MapPinned, Search, ShieldCheck, Sparkles, Users, Wallet } from 'lucide-react'
import { RentalAgreement } from '@/components/common/RentalAgreement'
import { SectionHeading } from '@/components/common/SectionHeading'
import { VehicleArt } from '@/components/common/VehicleArt'
import { Button } from '@/components/ui'
import { RENTER_STEPS } from '@/lib/content'
import { PageHero } from './PageHeroSection'

export function HowItWorksHeroSection() {
  return <PageHero eyebrow="How it works" title="Rent from locals. Drive with confidence." description="ByaheGo connects you with verified vehicle owners across Cebu. Here's what happens from search to return." />
}

export function RenterJourneySection() {
  const icons = [Search, Wallet, CarFront]
  return (
    <section className="container-page py-14">
      <SectionHeading eyebrow="For renters" title="Three steps to the open road" />
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {RENTER_STEPS.map((s, i) => {
          const Icon = icons[i]
          return (
            <div key={s.title} className="rounded-2xl border border-line-200 bg-white p-6 shadow-card">
              <span className="flex size-11 items-center justify-center rounded-xl bg-brand text-white"><Icon className="size-5" /></span>
              <p className="mt-4 text-xs font-bold text-brand">STEP {i + 1}</p>
              <h3 className="mt-1 text-lg font-bold">{s.title}</h3>
              <p className="mt-1.5 text-sm text-ink-500">{s.text}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function TrustSafetySection() {
  const items = [
    { icon: BadgeCheck, t: 'Every driver is verified', s: 'License, selfie and automatic document checks, confirmed by our team before your first self-drive trip.' },
    { icon: FileCheck2, t: 'Every vehicle is reviewed', s: 'Hosts submit photos plus OR/CR. We approve listings before they go live.' },
    { icon: ClipboardCheck, t: 'Pick-up & return checks', s: 'Odometer, fuel, body, interior, engine bay and tools are recorded with photos – no surprise charges.' },
    { icon: ShieldCheck, t: 'Damage policy on every trip', s: 'Choose Standard, Plus or Premium to cap what you pay for accidental damage. It is ByaheGo\'s policy, not insurance.' },
    { icon: Wallet, t: 'Refundable deposit', s: 'Held during the trip, returned within 3 days. Late fees or approved damage are deducted transparently.' },
    { icon: HeartHandshake, t: 'Fair disputes', s: 'If a host reports damage, our team reviews evidence from both sides before any charge.' },
  ]
  return (
    <section className="bg-white py-14">
      <div className="container-page">
        <SectionHeading eyebrow="Trust & safety" title="Built so everyone is protected" />
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((i) => (
            <div key={i.t} className="flex gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand"><i.icon className="size-5" /></span>
              <div><h3 className="font-bold">{i.t}</h3><p className="mt-1 text-sm text-ink-500">{i.s}</p></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function BecomeHostHeroSection() {
  return (
    <PageHero eyebrow="Host on ByaheGo" title="Earn from your idle vehicle" description="Your car, van or motorcycle can earn while you're at work or away. You set the price and the schedule – we handle bookings, payments and support.">
      <div className="mt-7 flex flex-wrap gap-3">
        <Button variant="accent" size="lg" to="/account/host-application">Apply to host</Button>
        <Button variant="outline-light" size="lg" to="/help#contact">Talk to our team</Button>
      </div>
    </PageHero>
  )
}

export function HostBenefitsSection() {
  const items = [
    { icon: Wallet, t: 'Get paid fast', s: 'Earnings go to your GCash, Maya or bank 3 days after every trip. Keep 85% of the rental.' },
    { icon: ShieldCheck, t: 'Host protection', s: 'Renters are verified, deposits are held, and we review damage claims and disputes. This is not an insurance policy.' },
    { icon: MapPinned, t: 'Use a ByaheGo hub', s: 'Hand over keys at a staffed hub with parking and CCTV, or meet renters near you.' },
    { icon: Sparkles, t: 'Tools that save time', s: 'Pick-up and return checklists, late-fee tracking, and an earnings dashboard.' },
  ]
  return (
    <section id="protection" className="container-page scroll-mt-20 py-14">
      <SectionHeading eyebrow="Why host with us" title="Everything you need to rent safely" />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((i) => (
          <div key={i.t} className="rounded-2xl border border-line-200 bg-white p-5 shadow-card">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand"><i.icon className="size-5" /></span>
            <h3 className="mt-4 font-bold">{i.t}</h3>
            <p className="mt-1 text-sm text-ink-500">{i.s}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export function HostStepsSection() {
  const steps = [
    ['Apply', 'Tell us about you and your vehicles. We review applications in 1–2 business days.'],
    ['List your vehicle', 'Add photos, set your daily rate, choose a pick-up spot and upload OR/CR.'],
    ['Get approved', 'Our team checks every listing before it goes live to renters.'],
    ['Hand over & earn', 'Do the pick-up check with the renter, record the return, and get paid.'],
  ]
  return (
    <section className="bg-white py-14">
      <div className="container-page grid items-center gap-10 lg:grid-cols-2">
        <div>
          <SectionHeading eyebrow="How hosting works" title="From application to first payout" />
          <ol className="mt-6 space-y-5">
            {steps.map(([t, s], i) => (
              <li key={t} className="flex gap-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink-900 text-sm font-bold text-white">{i + 1}</span>
                <div><h3 className="font-bold">{t}</h3><p className="text-sm text-ink-500">{s}</p></div>
              </li>
            ))}
          </ol>
          <Button className="mt-7" size="lg" to="/account/host-application">Start your application</Button>
        </div>
        <div className="rounded-3xl bg-brand-tint p-8"><VehicleArt type="pickup" color="#D35400" className="w-full" /></div>
      </div>
    </section>
  )
}

export function AboutStorySection() {
  return (
    <>
      <PageHero eyebrow="About ByaheGo" title="Your journey, our priority" description="We started ByaheGo in Cordova, Cebu to make renting a vehicle as easy as booking a ride – with clear prices, verified people and real local support." />
      <section className="container-page grid gap-6 py-14 md:grid-cols-3">
        {[
          { icon: Users, t: 'Local first', s: 'Every host is a Cebuano vehicle owner or small rental business. Your peso stays in the community.' },
          { icon: ShieldCheck, t: 'Safety by design', s: 'Verified drivers, reviewed listings, recorded inspections and fair dispute handling.' },
          { icon: Leaf, t: 'Fewer idle cars', s: 'Sharing vehicles that would otherwise sit parked means fewer cars needed on our roads.' },
        ].map((i) => (
          <div key={i.t} className="rounded-2xl border border-line-200 bg-white p-6 shadow-card">
            <i.icon className="size-7 text-brand" />
            <h3 className="mt-3 text-lg font-bold">{i.t}</h3>
            <p className="mt-1 text-sm text-ink-500">{i.s}</p>
          </div>
        ))}
      </section>
    </>
  )
}

export function HelpHeroSection() {
  return (
    <PageHero eyebrow="Help center" title="How can we help?" description="Answers about bookings, payments, refunds, verification and hosting.">
      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        {[['Cancellation policy', '/terms#cancellation'], ['Late returns', '/terms#late'], ['Damage & liability', '/terms#damage'], ['Contact us', '#contact']].map(([l, to]) => (
          <Link key={l} to={to} className="rounded-full bg-white/10 px-3.5 py-2 font-semibold text-white hover:bg-white/20">{l}</Link>
        ))}
      </div>
    </PageHero>
  )
}

export function TermsSection() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Rental agreement & terms" description="The plain-language rules every renter accepts at checkout. Hosts follow the same rules." />
      <section className="container-page max-w-3xl py-12">
        <div className="rounded-3xl bg-white p-6 shadow-card sm:p-10"><RentalAgreement /></div>
      </section>
    </>
  )
}

export function PrivacySection() {
  const items = [
    ['What we collect', 'Your name, contact details, driver\'s license and selfie (for verification), trip details, and payment references. We never store your full card number or e-wallet PIN.'],
    ['Signing in with Google or Facebook', 'If you choose "Continue with Google" or "Continue with Facebook", we only receive your name, email address and an account ID from them. We never see your Google or Facebook password and never post anything for you. To have this data deleted, see "Your rights" below.'],
    ['Why we collect it', 'To verify drivers, process bookings and refunds, keep trips safe, resolve disputes and meet legal requirements such as the Data Privacy Act of 2012 (RA 10173).'],
    ['Who can see your documents', 'Only ByaheGo\'s verification team. Hosts see your name, phone number and verified status – never your license photos.'],
    ['How long we keep it', 'Trip and payment records are kept for 10 years for tax purposes. Verification documents are deleted 2 years after your last trip, or sooner if you close your account.'],
    ['Your rights', 'You can access, correct or ask us to delete your personal data. Email support@byahego.ph and our Data Protection Officer will reply within 15 days.'],
  ]
  return (
    <>
      <PageHero eyebrow="Legal" title="Privacy policy" description="How ByaheGo collects, uses and protects your personal information." />
      <section className="container-page max-w-3xl space-y-6 py-12">
        {items.map(([t, s]) => (
          <div key={t} className="rounded-2xl border border-line-200 bg-white p-6">
            <h2 className="font-bold">{t}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-700">{s}</p>
          </div>
        ))}
      </section>
    </>
  )
}

export function NotFoundSection() {
  return (
    <section className="container-page flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <VehicleArt type="hatchback" color="#FFB224" className="w-56" />
      <p className="mt-6 text-sm font-bold text-brand">404</p>
      <h1 className="mt-1 text-3xl font-extrabold">Looks like this road doesn't exist</h1>
      <p className="mt-2 max-w-md text-ink-500">The page you're looking for was moved or never existed. Let's get you back on track.</p>
      <div className="mt-6 flex gap-3">
        <Button to="/">Go home</Button>
        <Button variant="secondary" to="/vehicles">Browse vehicles</Button>
      </div>
    </section>
  )
}
