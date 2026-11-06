import { VehicleArt } from '@/components/common/VehicleArt'
import { Button } from '@/components/ui'

export function HostCtaSection() {
  return (
    <section className="container-page py-14">
      <div className="relative overflow-hidden rounded-3xl bg-brand px-6 py-10 text-white sm:px-10 lg:py-14">
        <div className="pointer-events-none absolute -right-16 -bottom-24 size-96 rounded-full bg-white/10" />
        <div className="relative grid items-center gap-8 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold tracking-[0.14em] text-accent uppercase">For vehicle owners</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Earn from your idle vehicle</h2>
            <p className="mt-3 max-w-md text-white/80">List your car, van or motorcycle for free. You set the price and schedule, and every trip is backed by ByaheGo's damage policy and a held security deposit.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="accent" to="/account/host-application">
                List your vehicle
              </Button>
              <Button variant="outline-light" to="/become-a-host">
                How hosting works
              </Button>
            </div>
          </div>
          <VehicleArt type="van" color="#2B2F33" className="mx-auto w-full max-w-md drop-shadow-xl" />
        </div>
      </div>
    </section>
  )
}
