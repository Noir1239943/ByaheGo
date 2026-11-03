import type { PaymentMethod, VehicleType } from '@/types'

export const VEHICLE_TYPES: { value: VehicleType; label: string; plural: string }[] = [
  { value: 'sedan', label: 'Sedan', plural: 'Sedans' },
  { value: 'hatchback', label: 'Hatchback', plural: 'Hatchbacks' },
  { value: 'suv', label: 'SUV', plural: 'SUVs' },
  { value: 'mpv', label: 'MPV', plural: 'MPVs' },
  { value: 'van', label: 'Van', plural: 'Vans' },
  { value: 'pickup', label: 'Pickup', plural: 'Pickups' },
  { value: 'motorcycle', label: 'Motorcycle', plural: 'Motorcycles' },
]

export const typeLabel = (t: string) => VEHICLE_TYPES.find((v) => v.value === t)?.label ?? t

export const FEATURE_OPTIONS = [
  'Air conditioning', 'Bluetooth audio', 'USB charging', 'Backup camera', 'Dash cam', 'Apple CarPlay', 'Android Auto',
  'Child seat anchors', 'Keyless entry', 'Cruise control', 'Roof rack', 'Spare tire & tools', '4x4', 'Helmet included',
]

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; hint: string; badge?: string }[] = [
  { value: 'gcash', label: 'GCash', hint: 'Approve the payment in your GCash app', badge: 'Most popular' },
  { value: 'maya', label: 'Maya', hint: 'Approve the payment in your Maya app' },
  { value: 'card', label: 'Credit or debit card', hint: 'Visa, Mastercard and JCB, typed on a secure page' },
  { value: 'qrph', label: 'QR Ph', hint: 'Scan with any bank or e-wallet app' },
  { value: 'grabpay', label: 'GrabPay', hint: 'Pay with your GrabPay wallet' },
  { value: 'shopeepay', label: 'ShopeePay', hint: 'Pay with your ShopeePay wallet' },
]

export const INSPECTION_ITEMS: { key: string; label: string }[] = [
  { key: 'exterior', label: 'Exterior – no new scratches or dents' },
  { key: 'interior', label: 'Interior clean, no damage or stains' },
  { key: 'tires', label: 'Tires and spare in good condition' },
  { key: 'lights', label: 'Lights, wipers and horn working' },
  { key: 'engine_bay', label: 'Engine bay complete – battery and parts intact' },
  { key: 'spare_tools', label: 'Early warning device, jack and tools present' },
  { key: 'documents', label: 'OR/CR copy inside the vehicle' },
]

export const INCIDENT_LABELS: Record<string, string> = {
  damage: 'Damage',
  theft: 'Theft / not returned',
  missing_parts: 'Missing parts or accessories',
  accident: 'Accident',
  breakdown: 'Breakdown',
  traffic_violation: 'Traffic violation',
  other: 'Other',
}

export const RESTRICTION_CODES = [
  { code: 'A', label: 'A – Motorcycle' },
  { code: 'A1', label: 'A1 – Tricycle' },
  { code: 'B', label: 'B – Car up to 5,000 kg' },
  { code: 'B1', label: 'B1 – Car, up to 8 passengers' },
  { code: 'B2', label: 'B2 – Light vehicle with trailer' },
  { code: 'C', label: 'C – Medium/heavy truck' },
]

export const PAYOUT_LABELS: Record<string, string> = { gcash: 'GCash', maya: 'Maya', bank: 'Bank transfer' }

export const SUPPORT_EMAIL = 'support@byahego.ph'
export const SUPPORT_PHONE = '(032) 888 2924'

export const PAYMENT_TYPE_LABEL: Record<string, string> = {
  charge: 'Payment',
  balance: 'Balance payment',
  extension: 'Extra time (extension)',
  refund: 'Refund',
  late_fee: 'Late return fee',
  damage: 'Damage charge',
  cancellation_fee: 'Cancellation fee',
}
