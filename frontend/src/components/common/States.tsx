import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button, Skeleton, Spinner } from '@/components/ui'
import { getErrorMessage } from '@/lib/api'
import { cn } from '@/lib/cn'

export function PageLoader({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex min-h-[40vh] flex-col items-center justify-center gap-3 text-sm text-ink-500', className)}>
      <Spinner className="size-7" />
      {label}
    </div>
  )
}

export function ErrorState({ error, onRetry, title = 'We couldn\'t load this page', className }: { error?: unknown; onRetry?: () => void; title?: string; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-2xl border border-line-200 bg-white px-6 py-12 text-center', className)}>
      <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-danger-soft text-danger">
        <AlertCircle className="size-6" />
      </div>
      <h3 className="font-bold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-500">{getErrorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-4" icon={<RefreshCw className="size-4" />} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function CardGridSkeleton({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid gap-5 sm:grid-cols-2 xl:grid-cols-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-line-200 bg-white">
          <Skeleton className="aspect-[4/3] rounded-none" />
          <div className="space-y-2 p-4">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="mt-3 h-5 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  )
}
