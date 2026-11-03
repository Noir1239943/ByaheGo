import { useState } from 'react'
import { cn } from '@/lib/cn'
import type { VehicleType } from '@/types'
import { VehicleArt } from './VehicleArt'

type Props = { photo?: string | null; type: VehicleType; color?: string; alt: string; className?: string; artClassName?: string; tint?: boolean }

/** Shows the host's photo, or the design-system illustration when there's no photo. */
export function VehicleImage({ photo, type, color, alt, className, artClassName, tint = true }: Props) {
  const [failed, setFailed] = useState(false)
  if (photo && !failed) {
    return <img src={photo} alt={alt} loading="lazy" onError={() => setFailed(true)} className={cn('h-full w-full object-cover', className)} />
  }
  return (
    <div className={cn('flex h-full w-full items-center justify-center', tint && 'bg-gradient-to-b from-brand-tint to-[#E4F4EF]', className)}>
      <VehicleArt type={type} color={color} className={cn('w-[78%] max-w-[260px]', artClassName)} />
    </div>
  )
}
