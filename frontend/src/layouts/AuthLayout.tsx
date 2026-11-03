import { Link, Outlet } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { Wordmark } from '@/components/common/Logo'

export default function AuthLayout() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-hero">
      <div className="pointer-events-none absolute -top-32 -left-32 size-[420px] rounded-full bg-brand/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 -bottom-24 size-[360px] rounded-full bg-accent/80 blur-[2px]" />
      <div className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/80 hover:text-white">
          <ArrowLeft className="size-4" /> Back to ByaheGo
        </Link>
      </div>
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-12">
        <Wordmark className="mb-6 w-64 sm:w-72" />
        <Outlet />
      </main>
    </div>
  )
}
