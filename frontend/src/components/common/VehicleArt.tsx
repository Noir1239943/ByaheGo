import { useId } from 'react'
import type { VehicleType } from '@/types'

const BODY: Record<Exclude<VehicleType, 'motorcycle'>, { body: string; windows: string[]; wheels: [number, number]; r: number; extra?: 'rack' | 'stripe' | 'bed' }> = {
  sedan: {
    body: 'M18 78 Q18 66 30 63 L66 58 Q80 40 100 36 L150 36 Q168 38 182 56 L210 60 Q224 63 224 76 L224 86 Q224 90 220 90 L22 90 Q18 90 18 86 Z',
    windows: ['M88 57 L102 41 Q106 39 112 39 L126 39 L126 57 Z', 'M132 57 L132 39 L148 39 Q160 40 170 52 L174 57 Z'],
    wheels: [62, 180], r: 15,
  },
  hatchback: {
    body: 'M30 80 Q30 66 42 62 L72 56 Q88 38 106 34 L176 34 Q186 34 190 42 L200 60 Q208 64 208 74 L208 86 Q208 90 204 90 L34 90 Q30 90 30 86 Z',
    windows: ['M94 55 L108 39 L140 39 L140 55 Z', 'M146 55 L146 39 L176 39 Q182 39 185 45 L192 55 Z'],
    wheels: [70, 174], r: 15,
  },
  suv: {
    body: 'M16 82 L16 64 Q16 56 26 54 L52 50 L68 30 Q72 26 80 26 L176 26 Q186 26 192 34 L204 52 L216 56 Q226 59 226 70 L226 86 Q226 90 222 90 L20 90 Q16 90 16 86 Z',
    windows: ['M76 50 L86 32 L122 32 L122 50 Z', 'M128 50 L128 32 L172 32 Q180 32 184 38 L193 50 Z'],
    wheels: [62, 182], r: 17, extra: 'rack',
  },
  mpv: {
    body: 'M14 82 Q14 64 26 60 L54 54 Q70 30 92 28 L190 28 Q204 28 210 42 L218 58 Q228 62 228 74 L228 86 Q228 90 224 90 L18 90 Q14 90 14 86 Z',
    windows: ['M80 52 L92 34 L124 34 L124 52 Z', 'M130 52 L130 34 L168 34 L168 52 Z', 'M174 52 L174 34 L196 34 Q203 34 206 41 L210 52 Z'],
    wheels: [60, 184], r: 16,
  },
  van: {
    body: 'M10 84 L10 40 Q10 24 26 22 L200 22 Q214 22 220 34 L230 58 Q232 62 232 70 L232 86 Q232 90 228 90 L14 90 Q10 90 10 86 Z',
    windows: ['M22 32 H60 V52 H22 Z', 'M66 32 H104 V52 H66 Z', 'M110 32 H148 V52 H110 Z', 'M154 32 H194 V52 H154 Z', 'M200 32 L212 32 Q217 34 221 45 L224 54 L200 54 Z'],
    wheels: [54, 190], r: 16, extra: 'stripe',
  },
  pickup: {
    body: 'M12 84 L12 62 Q12 56 20 56 L104 56 L104 40 Q104 30 114 30 L160 30 Q170 30 176 38 L190 54 L214 58 Q226 60 226 72 L226 86 Q226 90 222 90 L16 90 Q12 90 12 86 Z',
    windows: ['M112 54 L114 36 L140 36 L140 54 Z', 'M146 54 L146 36 L162 36 Q168 36 172 42 L181 54 Z'],
    wheels: [56, 184], r: 17, extra: 'bed',
  },
}

function isLight(hex: string) {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return 0.299 * r + 0.587 * g + 0.114 * b > 200
}

/** Flat illustration used when a listing has no photos yet (from the ByaheGo design system). */
export function VehicleArt({ type, color = '#0D7C6B', className }: { type: VehicleType; color?: string; className?: string }) {
  const uid = useId().replace(/:/g, '')
  const outline = isLight(color) ? '#C3CCD3' : 'none'

  if (type === 'motorcycle') {
    return (
      <svg viewBox="0 0 240 120" className={className} role="img" aria-label="Motorcycle illustration">
        <ellipse cx="121" cy="108" rx="78" ry="5" fill="#0E1F29" opacity=".08" />
        <circle cx="70" cy="90" r="18" fill="#1E2A33" /><circle cx="70" cy="90" r="8" fill="#DDE3E8" />
        <circle cx="174" cy="90" r="18" fill="#1E2A33" /><circle cx="174" cy="90" r="8" fill="#DDE3E8" />
        <path d="M62 80 Q66 62 92 62 L128 62 Q136 52 148 48 L156 34 L164 36 L158 50 Q176 60 184 82 L172 84 Q162 72 148 74 L120 82 Z" fill={color} stroke={outline} strokeWidth="1.5" />
        <rect x="80" y="52" width="48" height="10" rx="5" fill="#1E2A33" />
        <path d="M156 34 L148 24 M152 26 L166 24" stroke="#1E2A33" strokeWidth="4" strokeLinecap="round" />
        <circle cx="171" cy="52" r="4" fill="#FFE8A3" />
        <path d="M70 90 L104 76" stroke="#596B77" strokeWidth="4" strokeLinecap="round" />
      </svg>
    )
  }
  const v = BODY[type] ?? BODY.sedan
  return (
    <svg viewBox="0 0 240 120" className={className} role="img" aria-label={`${type} illustration`}>
      <defs>
        <clipPath id={`clip-${uid}`}>
          <path d={v.body} />
        </clipPath>
      </defs>
      <ellipse cx="121" cy="106" rx="104" ry="6" fill="#0E1F29" opacity=".08" />
      {v.extra === 'rack' && <rect x="84" y="20" width="90" height="4" rx="2" fill="#1E2A33" />}
      <path d={v.body} fill={color} stroke={outline} strokeWidth="1.5" />
      <g clipPath={`url(#clip-${uid})`}>
        <rect x="0" y="74" width="240" height="30" fill="#000" opacity=".1" />
        {v.extra === 'stripe' && <rect x="0" y="58" width="240" height="5" fill="#FFB224" />}
      </g>
      {v.windows.map((d) => (
        <path key={d} d={d} fill="#E6F3F1" stroke="#0E1F29" strokeOpacity=".12" />
      ))}
      {v.extra === 'bed' && <path d="M14 58 H102" stroke="#0E1F29" strokeOpacity=".25" strokeWidth="3" strokeLinecap="round" />}
      <rect x={v.wheels[1] + 26} y="66" width="10" height="5" rx="2" fill="#FFE8A3" />
      <rect x={v.wheels[0] - 44} y="66" width="7" height="5" rx="2" fill="#E5484D" />
      {v.wheels.map((x) => (
        <g key={x}>
          <circle cx={x} cy="90" r={v.r} fill="#1E2A33" />
          <circle cx={x} cy="90" r={v.r * 0.45} fill="#DDE3E8" />
        </g>
      ))}
    </svg>
  )
}
