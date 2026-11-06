import type { ShotAngle } from '@/types'

const SIDE = 'M40 150 L40 125 Q40 110 60 108 L120 100 L150 70 Q155 62 170 62 L250 62 Q265 62 272 70 L305 100 L350 108 Q365 110 365 125 L365 150 Z'
const FRONT = 'M105 150 L105 112 Q105 96 122 93 L150 62 Q156 56 168 56 L232 56 Q244 56 250 62 L278 93 Q295 96 295 112 L295 150 Z'

/** A simple outline that shows how to frame each shot. Pure decoration over the camera view. */
export function ShotGuide({ angle, className }: { angle: ShotAngle | 'damage'; className?: string }) {
  const stroke = { fill: 'none', stroke: 'white', strokeWidth: 3, strokeDasharray: '9 7', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <svg viewBox="0 0 400 225" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      {(angle === 'driver_side' || angle === 'passenger_side') && (
        <g {...stroke} transform={angle === 'passenger_side' ? 'translate(400 0) scale(-1 1)' : undefined}>
          <path d={SIDE} />
          <circle cx="112" cy="152" r="25" />
          <circle cx="295" cy="152" r="25" />
          <path d="M150 100 L165 72 L212 72 L212 100 Z M222 100 L222 72 L255 72 L282 100 Z" />
        </g>
      )}
      {(angle === 'front' || angle === 'rear') && (
        <g {...stroke}>
          <path d={FRONT} />
          <path d="M138 96 L158 66 L242 66 L262 96 Z" />
          <rect x="95" y="150" width="34" height="26" rx="5" />
          <rect x="271" y="150" width="34" height="26" rx="5" />
          {angle === 'front' ? (
            <>
              <circle cx="132" cy="118" r="11" />
              <circle cx="268" cy="118" r="11" />
              <rect x="170" y="126" width="60" height="18" rx="4" />
            </>
          ) : (
            <>
              <rect x="120" y="108" width="28" height="14" rx="3" />
              <rect x="252" y="108" width="28" height="14" rx="3" />
              <rect x="172" y="124" width="56" height="20" rx="3" />
            </>
          )}
        </g>
      )}
      {angle === 'dashboard' && (
        <g {...stroke}>
          <path d="M40 80 Q200 40 360 80" />
          <circle cx="135" cy="125" r="45" />
          <circle cx="135" cy="125" r="10" />
          <rect x="230" y="105" width="110" height="50" rx="8" />
        </g>
      )}
      {angle === 'back_seats' && (
        <g {...stroke}>
          <rect x="60" y="60" width="280" height="85" rx="14" />
          <path d="M140 60 L140 145 M260 60 L260 145" />
          <rect x="60" y="150" width="280" height="30" rx="8" />
        </g>
      )}
      {angle === 'trunk' && (
        <g {...stroke}>
          <rect x="55" y="75" width="290" height="105" rx="10" />
          <path d="M55 75 L90 38 L310 38 L345 75" />
          <circle cx="200" cy="130" r="32" />
          <circle cx="200" cy="130" r="12" />
        </g>
      )}
      {angle === 'engine' && (
        <g {...stroke}>
          <rect x="50" y="55" width="300" height="130" rx="10" />
          <rect x="70" y="75" width="70" height="40" rx="4" />
          <rect x="165" y="75" width="95" height="90" rx="6" />
          <circle cx="305" cy="105" r="28" />
        </g>
      )}
      {angle === 'odometer' && (
        <g {...stroke}>
          <rect x="80" y="85" width="240" height="55" rx="8" />
          <path d="M105 112 h20 M140 112 h20 M175 112 h20 M210 112 h20 M245 112 h20 M280 112 h20" />
        </g>
      )}
      {angle === 'fuel' && (
        <g {...stroke}>
          <path d="M90 160 A110 110 0 0 1 310 160" />
          <path d="M200 160 L246 98" />
          <circle cx="200" cy="160" r="9" />
          <path d="M90 160 h18 M310 160 h-18 M200 50 v18" />
        </g>
      )}
      {angle === 'damage' && (
        <g {...stroke}>
          <circle cx="200" cy="112" r="70" />
          <path d="M200 62 v100 M150 112 h100" />
        </g>
      )}
    </svg>
  )
}
