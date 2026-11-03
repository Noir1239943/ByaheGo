export type Role = 'renter' | 'host' | 'admin'
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected'
export type VehicleType = 'sedan' | 'hatchback' | 'suv' | 'mpv' | 'van' | 'pickup' | 'motorcycle'
export type PaymentMethod = 'gcash' | 'maya' | 'card' | 'qrph' | 'grabpay' | 'shopeepay'
export type RentalType = 'self' | 'driver'
export type ProtectionKey = 'standard' | 'plus' | 'premium'

export interface UserBrief {
  id: number
  name: string
  username: string
  email: string
  phone: string | null
  initials: string
  role: Role
  status: 'active' | 'suspended' | 'revoked'
  verification_status: VerificationStatus
  joined_at: string | null
}

export interface User extends UserBrief {
  city: string | null
  is_admin: boolean
  is_super_admin?: boolean
  host_cancellations?: number
  is_host: boolean
  suspended_reason: string | null
  suspended_until?: string | null
  revoked_at?: string | null
  notify_email: boolean
  notify_sms: boolean
  has_password: boolean
  google_linked: boolean
  facebook_linked?: boolean
  payout: { method: 'gcash' | 'maya' | 'bank'; account_name: string; account_masked: string } | null
  host_application_status: 'pending' | 'approved' | 'rejected' | null
  last_login_at: string | null
}

export interface Hub {
  id: number
  name: string
  address: string
  city: string
  lat: number
  lng: number
  hours: string
  parking_notes: string | null
}

export interface VehicleCard {
  id: number
  name: string
  make: string
  model: string
  year: number
  type: VehicleType
  transmission: 'automatic' | 'manual'
  fuel: 'gasoline' | 'diesel' | 'hybrid' | 'electric'
  seats: number
  color: string | null
  color_hex: string
  daily_rate: number
  rating_avg: number
  rating_count: number
  trips_count: number
  city: string | null
  /** Barangay or hub name – the only place name shown before booking. */
  area?: string | null
  pickup_type?: 'hub' | 'own'
  location_label: string
  instant_book: boolean
  with_driver_available: boolean
  driver_fee_per_day: number
  delivery_available: boolean
  pet_friendly: boolean
  photo: string | null
  lat: number | null
  lng: number | null
  is_favorite?: boolean
  distance_km?: number | null
  availability?: 'available' | 'booked' | 'on_trip'
  on_trip_now?: boolean
  viewed_at?: string
  saved_at?: string
  price_alert?: boolean
  is_available?: boolean
}

export interface ProtectionPlan {
  key: ProtectionKey
  name: string
  price_per_day: number
  liability_cap: number
  summary: string
}

export interface Review {
  id: number
  rating: number
  comment: string | null
  renter: { name: string; initials: string }
  created_at: string
}

export interface VehicleDetail extends VehicleCard {
  description: string | null
  features: string[]
  photos: string[]
  weekly_rate: number | null
  security_deposit: number
  late_fee_per_hour: number
  delivery_fee: number
  min_days: number
  grace_minutes: number
  fuel_policy: 'same_level' | 'full_to_full'
  status: string
  pickup: { type: 'hub' | 'own'; label: string; hub: Hub | null; address: string | null; city: string | null; area: string | null; approximate: boolean }
  host: { id: number; name: string; initials: string; joined_at: string | null; trips: number; verified: boolean; vehicles: number }
  policies: {
    cancellation_cutoff_hours: number
    late_grace_minutes: number
    late_fee_daily_cap: number
    deposit_release_days: number
    service_fee_rate: number
    protection_plans: ProtectionPlan[]
  }
  is_favorite: boolean
  reviews: Review[]
  rating_breakdown: Record<string, number>
  booked_ranges: { from: string; to: string }[]
  similar: VehicleCard[]
}

export interface HostVehicle extends Omit<VehicleDetail, 'is_favorite' | 'reviews' | 'rating_breakdown' | 'booked_ranges' | 'similar'> {
  plate_number: string | null
  rejection_reason: string | null
  pickup_type: 'hub' | 'own'
  hub_id: number | null
  pickup_address: string | null
  /** The exact pin. Only the host ever receives this. */
  pin_lat: number | null
  pin_lng: number | null
  or_media_id: number | null
  cr_media_id: number | null
  ctpl_media_id: number | null
  ctpl_expiry: string | null
  grace_minutes: number
  fuel_policy: 'same_level' | 'full_to_full'
  photo_ids: number[]
  submitted_at: string | null
  approved_at: string | null
  created_at: string | null
  bookings_count: number
  earnings: number
  host_name: string | null
  status: 'draft' | 'pending' | 'live' | 'rejected' | 'paused'
}

export interface Quote {
  days: number
  hours: number
  daily_rate: number
  rental_subtotal: number
  weekly_discount: number
  driver_fee_total: number
  protection_plan: ProtectionKey
  protection_name: string
  protection_total: number
  liability_cap: number
  service_fee: number
  service_fee_rate: number
  total: number
  security_deposit: number
  due_now: number
  cancellation_fee: number
  free_cancellation_until: string
  available: boolean
}

export interface Payment {
  id: number
  type: 'charge' | 'refund' | 'late_fee' | 'damage' | 'balance' | 'cancellation_fee'
  method: PaymentMethod | 'deposit'
  method_label: string
  amount: number
  /** pending | succeeded | failed | expired */
  status: string
  receipt_no: string
  gateway_ref: string | null
  account_hint: string | null
  description: string
  reason: string | null
  failure_reason: string | null
  paid_at: string | null
  /** The real invoice (or refund receipt) number, once one has been issued. */
  invoice_no: string | null
  invoice_kind: 'invoice' | 'refund_receipt' | null
  /** Admin only. */
  provider?: string | null
  provider_payment_id?: string | null
  provider_refund_id?: string | null
  provider_session_id?: string | null
  attempts?: number
  requested_by?: string | null
  created_at: string
  booking_reference: string | null
  vehicle_name: string | null
  user: UserBrief | null
}

export type BookingStatus = 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled'
export type DisplayStatus = 'pending' | 'upcoming' | 'active' | 'completed' | 'cancelled' | 'under_review'

export interface BookingRow {
  id: number
  /** Admin views only: set when the renter or host was blocked and the trip needs a decision. */
  admin_flag?: 'renter_blocked' | 'host_blocked' | null
  admin_flag_note?: string | null
  reference: string
  status: BookingStatus
  display_status: DisplayStatus
  payment_status: string
  deposit_status: string
  pickup_at: string
  return_at: string
  days: number
  total: number
  amount_paid: number
  balance_due: number
  host_earnings: number
  pickup_label: string
  rental_type: RentalType
  vehicle: VehicleCard | null
  renter: UserBrief | null
  host: UserBrief | null
  has_open_incident: boolean
  can_cancel: boolean
  can_review: boolean
  created_at: string
}

export interface Inspection {
  stage: 'pickup' | 'return'
  odometer: number
  fuel_level: number
  checklist: Record<string, boolean>
  notes: string | null
  created_at: string
}

export interface BookingIncident {
  id: number
  type: string
  description: string
  status: 'open' | 'resolved' | 'dismissed'
  amount_claimed: number
  amount_approved: number
  resolution_notes: string | null
  created_at: string
  reporter_role: 'host' | 'renter' | 'admin'
}

export interface Booking extends Omit<BookingRow, 'vehicle' | 'has_open_incident'> {
  actual_pickup_at: string | null
  actual_return_at: string | null
  protection: ProtectionPlan
  daily_rate: number
  rental_subtotal: number
  driver_fee_total: number
  protection_total: number
  service_fee: number
  security_deposit: number
  late_hours: number
  late_fee: number
  damage_charge: number
  deposit_refunded: number
  pickup_lat: number | null
  pickup_lng: number | null
  driver: { name: string; phone: string | null; email: string | null; license_no: string | null }
  payment_method: PaymentMethod
  payment_method_label: string
  agreement: { version: string | null; accepted_at: string | null; has_copy: boolean; signer_name: string | null; hash: string | null; text: string | null }
  cancellation_fee: number
  cancellation_fee_if_cancelled: number
  cancelled_at: string | null
  cancelled_by: string | null
  cancel_reason: string | null
  free_cancellation_until: string
  review: Review | null
  vehicle: VehicleCard
  payments: Payment[]
  /** Xendit's payment page for an unpaid booking (renter only). */
  checkout_url: string | null
  pay_by: string | null
  inspections: Inspection[]
  incidents: BookingIncident[]
  invoice_no: string
  commission?: number
  payout?: { amount: number; status: string; paid_at: string | null; scheduled_for: string | null } | null
  admin_note?: string | null
  refundable?: number
  commission_rate?: number
  events?: { type: string; message: string; actor: string; created_at: string }[]
}

/** Why a blocked person can't sign in, until when, and where to appeal. */
export interface BlockInfo {
  type: 'suspended' | 'revoked'
  reason: string | null
  until: string | null
  appeal_email: string
  appeal_url: string
}

export interface AuditLogEntry {
  id: number
  action: string
  actor: string | null
  target_type: string | null
  target_id: number | null
  target_label: string | null
  reason: string | null
  meta: Record<string, unknown> | null
  ip: string | null
  created_at: string
}

export type CheckResult = 'pass' | 'warn' | 'fail' | 'not_checked'

export interface AutoCheck {
  key: string
  label: string
  result: CheckResult
  detail: string
  /** `device` = reported by the renter's browser (supporting evidence only); `server` = checked by our API. */
  source?: 'server' | 'device'
  value?: number | null
}

export interface FaceBoxReport {
  x: number
  y: number
  w: number
  h: number
}

/** What the renter's browser reported about the photos. Not proof, only supports the admin's decision. */
export interface ClientChecksReport {
  face_similarity: number | null
  liveness: number | null
  antispoof: number | null
  ocr_keyword_hits: string[]
  ocr_text: { front: string; back: string }
  faces: { license: FaceBoxReport | null; selfie: FaceBoxReport | null }
  thresholds: Record<string, number>
}

export type AutoLabel = 'reject' | 'incomplete' | 'check' | 'good'

/** One audit-log entry: an automatic decision or a super-admin override. */
export interface VerificationDecisionLog {
  id: number
  event: 'auto_decision' | 'override'
  outcome: 'approve' | 'reject' | 'review'
  reason: string
  triggers: string[]
  checks: { key: string; result: CheckResult; source: string; value: number | null }[]
  scores: { score: number | null; label: string | null; face_similarity: number | null; liveness: number | null; antispoof: number | null }
  settings: { auto_approve?: boolean; face_match_min?: number; liveness_min?: number; antispoof_min?: number; margins?: Record<string, number> }
  actor: string | null
  created_at: string
}

export interface License {
  id: number
  license_type: 'ph' | 'foreign'
  license_number: string
  full_name: string
  birthdate: string
  expiry_date: string
  address: string | null
  nationality: string | null
  restriction_codes: string[]
  status: 'pending' | 'approved' | 'rejected' | 'revoked'
  rejection_reason: string | null
  submitted_at: string
  reviewed_at: string | null
  auto_score?: number
  auto_checks?: AutoCheck[]
  auto_label?: AutoLabel | null
  client_checks?: ClientChecksReport | null
  auto_decision?: 'approve' | 'reject' | 'review' | null
  decision_source?: 'auto' | 'admin' | null
  auto_decision_reason?: string | null
  auto_decided_at?: string | null
  override?: { by: string | null; at: string; note: string | null } | null
  decisions?: VerificationDecisionLog[] | null
  front_media_id?: number | null
  back_media_id?: number | null
  selfie_media_id?: number | null
  user?: UserBrief
  reviewer?: string | null
}

export interface HostApplication {
  id: number
  full_name: string
  phone: string
  city: string
  address: string | null
  vehicle_count: number
  vehicle_types: VehicleType[]
  business_name: string | null
  payout_method: 'gcash' | 'maya' | 'bank'
  payout_account_name: string
  payout_account_masked: string
  payout_bank?: string | null
  notes: string | null
  status: 'pending' | 'approved' | 'rejected'
  admin_notes: string | null
  submitted_at: string
  reviewed_at: string | null
  user: UserBrief | null
}

export interface AppNotification {
  id: number
  title: string
  body: string
  link: string | null
  kind: 'info' | 'success' | 'warning' | 'danger'
  read: boolean
  created_at: string
}

export interface PageMeta {
  current_page: number
  last_page: number
  per_page: number
  total: number
  from?: number | null
  to?: number | null
}

export interface Paginated<T> {
  data: T[]
  meta: PageMeta
}

export interface Incident {
  id: number
  type: string
  description: string
  amount_claimed: number
  amount_approved: number
  status: 'open' | 'resolved' | 'dismissed'
  resolution_notes: string | null
  photo_ids: number[]
  reporter: UserBrief | null
  reporter_role: 'host' | 'renter' | 'admin'
  created_at: string
  resolved_at: string | null
  booking: {
    reference: string
    vehicle_name: string
    renter: UserBrief
    host: UserBrief
    protection_plan: ProtectionKey
    liability_cap: number
    security_deposit: number
    status: BookingStatus
  } | null
}

export interface Payout {
  id: number
  amount: number
  status: 'scheduled' | 'paid'
  scheduled_for: string | null
  paid_at: string | null
  reference: string | null
  booking_reference: string | null
  vehicle_name: string | null
  host?: UserBrief
  payout_method?: string | null
  account?: string | null
}

export interface SupportTicket {
  id: number
  name: string
  email: string
  topic: string
  booking_reference: string | null
  message: string
  status: 'open' | 'closed'
  reply: string | null
  created_at: string
}
