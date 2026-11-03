import { useEffect, useState } from 'react'
import { Checkbox, Chip, Input, Segmented } from '@/components/ui'
import { useDebounce } from '@/hooks/useDebounce'
import { VEHICLE_TYPES } from '@/lib/constants'
import { useVehicleSearch } from './useVehicleSearch'

export function FiltersPanel({ facets }: { facets?: Record<string, number> }) {
  const { get, set, clearFilters, activeCount } = useVehicleSearch()
  const types = get('type') ? get('type').split(',') : []
  const [min, setMin] = useState(get('price_min'))
  const [max, setMax] = useState(get('price_max'))
  const dMin = useDebounce(min, 500)
  const dMax = useDebounce(max, 500)

  useEffect(() => {
    if (dMin !== get('price_min') || dMax !== get('price_max')) set({ price_min: dMin, price_max: dMax })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dMin, dMax])

  const toggleType = (t: string) => {
    const next = types.includes(t) ? types.filter((x) => x !== t) : [...types, t]
    set({ type: next.join(',') })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="font-bold">Filters {activeCount > 0 && <span className="text-brand">({activeCount})</span>}</p>
        {activeCount > 0 && (
          <button onClick={() => { setMin(''); setMax(''); clearFilters() }} className="text-sm font-semibold text-brand hover:underline">
            Reset
          </button>
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Rental type</p>
        <Segmented
          value={get('rental_type') === 'driver' ? 'driver' : 'self'}
          onChange={(v) => set({ rental_type: v === 'driver' ? 'driver' : null })}
          options={[{ value: 'self', label: 'Self-drive' }, { value: 'driver', label: 'With driver' }]}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Price per day</p>
        <div className="grid grid-cols-2 gap-2">
          <Input type="number" inputMode="numeric" min={0} placeholder="Min" value={min} onChange={(e) => setMin(e.target.value)} leftIcon={<span className="text-xs font-bold">₱</span>} aria-label="Minimum price" />
          <Input type="number" inputMode="numeric" min={0} placeholder="Max" value={max} onChange={(e) => setMax(e.target.value)} leftIcon={<span className="text-xs font-bold">₱</span>} aria-label="Maximum price" />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[['Under ₱1,500', '', '1500'], ['₱1,500–3,000', '1500', '3000'], ['₱3,000+', '3000', '']].map(([l, a, b]) => (
            <button key={l} onClick={() => { setMin(a); setMax(b) }} className="rounded-full bg-line-100 px-2.5 py-1 text-xs font-medium text-ink-700 hover:bg-brand-soft">
              {l}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Vehicle type</p>
        <div className="space-y-2">
          {VEHICLE_TYPES.map((t) => (
            <label key={t.value} className="flex cursor-pointer items-center justify-between text-sm">
              <span className="flex items-center gap-2.5">
                <input type="checkbox" className="size-4 accent-brand" checked={types.includes(t.value)} onChange={() => toggleType(t.value)} />
                {t.label}
              </span>
              <span className="text-xs text-ink-400">{facets?.[t.value] ?? 0}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Transmission</p>
        <div className="flex gap-2">
          {['automatic', 'manual'].map((t) => (
            <Chip key={t} active={get('transmission') === t} onClick={() => set({ transmission: get('transmission') === t ? null : t })}>
              {t === 'automatic' ? 'Automatic' : 'Manual'}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Seats</p>
        <div className="flex flex-wrap gap-2">
          {[2, 4, 5, 7, 10].map((n) => (
            <Chip key={n} active={get('seats') === String(n)} onClick={() => set({ seats: get('seats') === String(n) ? null : n })}>
              {n}+
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Fuel</p>
        <div className="flex flex-wrap gap-2">
          {['gasoline', 'diesel', 'hybrid'].map((f) => (
            <Chip key={f} active={get('fuel') === f} onClick={() => set({ fuel: get('fuel') === f ? null : f })}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Chip>
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        <p className="text-sm font-semibold">More filters</p>
        <Checkbox label="Instant book" checked={get('instant_book') === '1'} onChange={(e) => set({ instant_book: e.target.checked ? 1 : null })} />
        <Checkbox label="Delivery available" checked={get('delivery') === '1'} onChange={(e) => set({ delivery: e.target.checked ? 1 : null })} />
        <Checkbox label="Pet-friendly" checked={get('pet_friendly') === '1'} onChange={(e) => set({ pet_friendly: e.target.checked ? 1 : null })} />
      </div>
    </div>
  )
}
