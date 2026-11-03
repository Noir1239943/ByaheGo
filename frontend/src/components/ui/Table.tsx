import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type Column<T> = { key: string; header: ReactNode; cell: (row: T) => ReactNode; className?: string; headerClassName?: string }

export function Table<T>({ columns, rows, rowKey, onRowClick, empty, className }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string | number; onRowClick?: (row: T) => void; empty?: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-line-200 text-[11px] font-semibold tracking-wider text-ink-500 uppercase">
            {columns.map((c) => (
              <th key={c.key} className={cn('px-4 py-3 first:pl-5 last:pr-5', c.headerClassName)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={rowKey(r)}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={cn('border-b border-line-100 last:border-0', onRowClick && 'cursor-pointer transition hover:bg-page')}
            >
              {columns.map((c) => (
                <td key={c.key} className={cn('px-4 py-3.5 align-middle first:pl-5 last:pr-5', c.className)}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && empty}
    </div>
  )
}
