import { useEffect } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Link } from 'react-router'
import { peso } from '@/lib/format'
import type { VehicleCard } from '@/types'

const COLORS = { available: '#0D7C6B', booked: '#D64545', on_trip: '#FFB224' }

function pin(color: string, label: string, active: boolean) {
  return L.divIcon({
    className: 'byahego-pin',
    iconSize: [0, 0],
    html: `<div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center">
      <div style="background:${active ? '#0E1F29' : color};color:${color === COLORS.on_trip && !active ? '#0E1F29' : '#fff'};font:700 12px var(--font-sans);padding:5px 9px;border-radius:999px;box-shadow:0 4px 12px rgba(14,31,41,.25);white-space:nowrap;border:2px solid #fff">${label}</div>
      <div style="width:10px;height:10px;background:${active ? '#0E1F29' : color};transform:rotate(45deg);margin-top:-6px;border-right:2px solid #fff;border-bottom:2px solid #fff"></div></div>`,
  })
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  const key = points.map((p) => p.join(',')).join('|')
  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) map.setView(points[0], 14)
    else map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return null
}

type Props = { vehicles: VehicleCard[]; activeId?: number | null; onSelect?: (id: number) => void; className?: string; query?: string; me?: { lat: number; lng: number } | null }

/** Map of pick-up spots (OpenStreetMap). Markers are color-coded by live availability. */
export default function MapView({ vehicles, activeId, onSelect, className, query = '', me }: Props) {
  const withCoords = vehicles.filter((v) => v.lat && v.lng)
  // Vehicles at the same hub get a small offset so every marker stays clickable.
  const seen = new Map<string, number>()
  const placed = withCoords.map((v) => {
    const k = `${v.lat},${v.lng}`
    const n = seen.get(k) ?? 0
    seen.set(k, n + 1)
    const angle = n * 2.4
    const r = n === 0 ? 0 : 0.0028 * Math.sqrt(n)
    return { v, pos: [v.lat! + Math.sin(angle) * r, v.lng! + Math.cos(angle) * r] as [number, number] }
  })
  return (
    <MapContainer center={[10.3157, 123.9154]} zoom={12} scrollWheelZoom className={className} style={{ minHeight: 320 }}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitBounds points={placed.map((p) => p.pos)} />
      {me && (
        <Marker position={[me.lat, me.lng]} icon={L.divIcon({ className: 'byahego-pin', iconSize: [0, 0], html: '<div style="transform:translate(-50%,-50%);width:16px;height:16px;border-radius:999px;background:#2F6FB2;border:3px solid #fff;box-shadow:0 0 0 6px rgba(47,111,178,.25)"></div>' })}>
          <Popup>You are here</Popup>
        </Marker>
      )}
      {placed.map(({ v, pos }) => (
        <Marker
          key={v.id}
          position={pos}
          icon={pin(COLORS[v.availability ?? 'available'], peso(v.daily_rate), activeId === v.id)}
          zIndexOffset={activeId === v.id ? 1000 : 0}
          eventHandlers={{ click: () => onSelect?.(v.id) }}
        >
          <Popup>
            <div className="w-48">
              <p className="font-bold text-ink-900">{v.name}</p>
              <p className="text-xs text-ink-500">{v.location_label}</p>
              <p className="mt-1 text-xs font-semibold" style={{ color: COLORS[v.availability ?? 'available'] === COLORS.on_trip ? '#B7791F' : COLORS[v.availability ?? 'available'] }}>
                {v.availability === 'booked' ? 'Booked for your dates' : v.availability === 'on_trip' ? 'On a trip right now' : 'Available'}
              </p>
              <Link to={`/vehicles/${v.id}${query}`} className="mt-2 inline-block text-sm font-bold text-brand">
                {peso(v.daily_rate)}/day · View →
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
