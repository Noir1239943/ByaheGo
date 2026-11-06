import { Link } from 'react-router'
import { Mail, Phone } from 'lucide-react'
import { SUPPORT_EMAIL, SUPPORT_PHONE } from '@/lib/constants'
import { Logo } from './Logo'

const COLUMNS = [
  { title: 'Rent', links: [['Cars', '/vehicles?type=sedan,hatchback'], ['SUVs', '/vehicles?type=suv'], ['Vans', '/vehicles?type=van,mpv'], ['Pickups', '/vehicles?type=pickup'], ['Motorcycles', '/vehicles?type=motorcycle']] },
  { title: 'Company', links: [['About us', '/about'], ['How it works', '/how-it-works'], ['Live map', '/vehicles?view=map']] },
  { title: 'Hosts', links: [['List your vehicle', '/become-a-host'], ['Host protection', '/become-a-host#protection'], ['Host dashboard', '/host']] },
  { title: 'Support', links: [['Help center', '/help'], ['Cancellation policy', '/terms#cancellation'], ['Rental agreement', '/terms'], ['Contact us', '/help#contact']] },
]

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-hero text-white/80">
      <div className="container-page py-12">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_2fr]">
          <div>
            <Logo variant="dark" />
            <p className="mt-4 max-w-xs text-sm text-white/70">Rent cars, SUVs, vans and motorcycles from trusted local hosts across Cebu.</p>
            <div className="mt-5 space-y-2 text-sm">
              <a href={`mailto:${SUPPORT_EMAIL}`} className="flex items-center gap-2 hover:text-white">
                <Mail className="size-4 text-accent" /> {SUPPORT_EMAIL}
              </a>
              <a href="tel:+63328882924" className="flex items-center gap-2 hover:text-white">
                <Phone className="size-4 text-accent" /> {SUPPORT_PHONE}
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {COLUMNS.map((c) => (
              <div key={c.title}>
                <p className="mb-3 text-xs font-bold tracking-[0.14em] text-accent uppercase">{c.title}</p>
                <ul className="space-y-2 text-sm">
                  {c.links.map(([label, to]) => (
                    <li key={label}>
                      <Link to={to} className="text-white/75 hover:text-white">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} ByaheGo Philippines. Made in Cebu.</p>
          <div className="flex gap-4">
            <Link to="/terms" className="hover:text-white">Terms</Link>
            <Link to="/privacy" className="hover:text-white">Privacy</Link>
            <Link to="/help" className="hover:text-white">Help</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
