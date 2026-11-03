import { useEffect } from 'react'
import { isRouteErrorResponse, useRouteError } from 'react-router'
import { AlertCircle, Home, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui'
import { Logo } from './Logo'

/**
 * Shown by React Router (errorElement) when a page crashes while rendering or a route fails to load.
 * People get a plain message and a way forward. The technical error goes to the console, and is only shown on screen in development.
 */
export function RouteError() {
  const error = useRouteError()
  useEffect(() => { console.error('Page error:', error) }, [error])

  const notFound = isRouteErrorResponse(error) && error.status === 404
  const detail = error instanceof Error ? error.message : isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : String(error)

  return (
    <section className="flex min-h-[70vh] flex-col items-center justify-center px-6 py-16 text-center" role="alert">
      <Logo />
      <span className="mt-8 flex size-14 items-center justify-center rounded-2xl bg-danger-soft text-danger"><AlertCircle className="size-7" /></span>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{notFound ? 'We couldn\'t find that page' : 'Something went wrong'}</h1>
      <p className="mt-2 max-w-md text-ink-500">
        {notFound ? 'The page may have moved or the link is out of date.' : 'Sorry about that. Your account and bookings are safe. Try again, and if it keeps happening, tell us at support.'}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button icon={<RefreshCw className="size-4" />} onClick={() => window.location.reload()}>Try again</Button>
        <Button variant="secondary" icon={<Home className="size-4" />} to="/">Go to the home page</Button>
      </div>
      {import.meta.env.DEV && <pre className="mt-8 max-w-2xl overflow-auto rounded-xl bg-page p-4 text-left text-xs text-ink-700">{detail}</pre>}
    </section>
  )
}
