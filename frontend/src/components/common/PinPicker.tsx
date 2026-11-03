import { useEffect } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'

const icon = L.divIcon({
  className: 'byahego-pin',
  iconSize: [0, 0],
  html: `<div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center">
    <div style="width:30px;height:30px;border-radius:999px 999px 999px 0;transform:rotate(-45deg);background:#0D7C6B;border:3px solid #fff;box-shadow:0 4px 12px rgba(14,31,41,.35)"></div></div>`,
})

type Pin = { lat: number; lng: number }

function Clicks({ onPick }: { onPick: (p: Pin) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) })
  return null
}

/** Moves the map when the pin is set from outside the map (address search, "use my location"). */
function Follow({ pin, center }: { pin: Pin | null; center: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    if (pin) map.flyTo([pin.lat, pin.lng], Math.max(map.getZoom(), 16), { duration: 0.6 })
    else map.setView(center, 13)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin?.lat, pin?.lng, center[0], center[1]])
  return null
}

type Props = { pin: Pin | null; center: [number, number]; onPick: (p: Pin) => void; className?: string }

/** Click the map or drag the marker to set the pick-up pin (OpenStreetMap tiles). */
export default function PinPicker({ pin, center, onPick, className }: Props) {
  return (
    <MapContainer center={pin ? [pin.lat, pin.lng] : center} zoom={pin ? 16 : 13} scrollWheelZoom className={className} style={{ minHeight: 280 }}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Clicks onPick={onPick} />
      <Follow pin={pin} center={center} />
      {pin && (
        <Marker
          position={[pin.lat, pin.lng]}
          icon={icon}
          draggable
          eventHandlers={{ dragend: (e) => { const p = (e.target as L.Marker).getLatLng(); onPick({ lat: p.lat, lng: p.lng }) } }}
        />
      )}
    </MapContainer>
  )
}
