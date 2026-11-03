<?php

namespace App\Support;

use App\Models\Booking;
use App\Models\DriverLicense;
use App\Models\HostApplication;
use App\Models\Incident;
use App\Models\Media;
use App\Models\Payment;
use App\Models\Review;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\BookingService;
use App\Services\PaymentGateway;

/** Shapes models into the JSON the frontend consumes. */
class Present
{
    public static function initials(string $name): string
    {
        $parts = preg_split('/\s+/', trim($name));
        $first = mb_substr($parts[0] ?? '', 0, 1);
        $last = count($parts) > 1 ? mb_substr(end($parts), 0, 1) : '';
        return mb_strtoupper($first.$last);
    }

    public static function mediaUrl(?int $id): ?string
    {
        return $id ? url('/api/media/'.$id) : null;
    }

    public static function userBrief(?User $u): ?array
    {
        if (! $u) return null;
        return [
            'id' => $u->id,
            'name' => $u->name,
            'username' => $u->username,
            'email' => $u->email,
            'phone' => $u->phone,
            'initials' => self::initials($u->name),
            'role' => $u->role,
            'status' => $u->status,
            'verification_status' => $u->verification_status,
            'joined_at' => $u->created_at?->toIso8601String(),
        ];
    }

    public static function user(User $u): array
    {
        return self::userBrief($u) + [
            'city' => $u->city,
            'is_admin' => $u->isAdmin(),
            'is_super_admin' => (bool) $u->is_super_admin,
            'is_host' => $u->isHost(),
            'suspended_reason' => $u->suspended_reason,
            'notify_email' => $u->notify_email,
            'notify_sms' => $u->notify_sms,
            'has_password' => $u->password !== null,
            'google_linked' => $u->google_id !== null,
            'payout' => $u->payout_method ? [
                'method' => $u->payout_method,
                'account_name' => $u->payout_account_name,
                'account_masked' => $u->maskedPayoutAccount(),
            ] : null,
            'host_application_status' => $u->hostApplication?->status,
            'last_login_at' => $u->last_login_at?->toIso8601String(),
        ];
    }

    public static function vehicleCard(Vehicle $v, array $extra = []): array
    {
        $photo = $v->relationLoaded('photos') ? $v->photos->first() : $v->photos()->first();
        return array_merge([
            'id' => $v->id,
            'name' => $v->name,
            'make' => $v->make,
            'model' => $v->model,
            'year' => $v->year,
            'type' => $v->type,
            'transmission' => $v->transmission,
            'fuel' => $v->fuel,
            'seats' => $v->seats,
            'color' => $v->color,
            'color_hex' => $v->color_hex,
            'daily_rate' => $v->daily_rate,
            'rating_avg' => round((float) $v->rating_avg, 1),
            'rating_count' => $v->rating_count,
            'trips_count' => $v->trips_count,
            'city' => $v->pickup_type === 'hub' && $v->hub ? $v->hub->city : $v->city,
            'location_label' => $v->pickupLabel(),
            'instant_book' => $v->instant_book,
            'with_driver_available' => $v->with_driver_available,
            'driver_fee_per_day' => $v->driver_fee_per_day,
            'delivery_available' => $v->delivery_available,
            'pet_friendly' => $v->pet_friendly,
            'photo' => $photo ? self::mediaUrl($photo->media_id) : null,
            'lat' => $v->pickup_type === 'hub' && $v->hub ? $v->hub->lat : $v->lat,
            'lng' => $v->pickup_type === 'hub' && $v->hub ? $v->hub->lng : $v->lng,
        ], $extra);
    }

    public static function vehicleDetail(Vehicle $v): array
    {
        $host = $v->host;
        $hostTrips = Booking::where('host_id', $host->id)->where('status', 'completed')->count();
        return self::vehicleCard($v) + [
            'description' => $v->description,
            'features' => $v->features ?? [],
            'photos' => $v->photos->map(fn ($p) => self::mediaUrl($p->media_id))->values(),
            'weekly_rate' => $v->weekly_rate,
            'security_deposit' => $v->security_deposit,
            'late_fee_per_hour' => $v->late_fee_per_hour,
            'delivery_fee' => $v->delivery_fee,
            'min_days' => $v->min_days,
            'status' => $v->status,
            'pickup' => [
                'type' => $v->pickup_type,
                'label' => $v->pickupLabel(),
                'hub' => $v->hub ? $v->hub->only(['id', 'name', 'address', 'city', 'lat', 'lng', 'hours', 'parking_notes']) : null,
                'address' => $v->pickup_address,
                'city' => $v->city,
            ],
            'host' => [
                'id' => $host->id,
                'name' => $host->name,
                'initials' => self::initials($host->name),
                'joined_at' => $host->created_at?->toIso8601String(),
                'trips' => $hostTrips,
                'verified' => true,
                'vehicles' => $host->vehicles()->where('status', 'live')->count(),
            ],
            'policies' => [
                'cancellation_cutoff_hours' => (int) Settings::get('cancellation_cutoff_hours'),
                'late_grace_minutes' => (int) Settings::get('late_grace_minutes'),
                'late_fee_daily_cap' => Settings::get('late_fee_daily_cap'),
                'deposit_release_days' => (int) Settings::get('deposit_release_days'),
                'service_fee_rate' => Settings::get('service_fee_rate'),
                'protection_plans' => array_values(Protection::PLANS),
            ],
        ];
    }

    public static function hostVehicle(Vehicle $v): array
    {
        return self::vehicleDetail($v) + [
            'plate_number' => $v->plate_number,
            'rejection_reason' => $v->rejection_reason,
            'pickup_type' => $v->pickup_type,
            'hub_id' => $v->hub_id,
            'pickup_address' => $v->pickup_address,
            'or_media_id' => $v->or_media_id,
            'cr_media_id' => $v->cr_media_id,
            'photo_ids' => $v->photos->pluck('media_id')->values(),
            'submitted_at' => $v->submitted_at?->toIso8601String(),
            'approved_at' => $v->approved_at?->toIso8601String(),
            'created_at' => $v->created_at?->toIso8601String(),
            'bookings_count' => $v->bookings()->whereIn('status', ['confirmed', 'active', 'completed'])->count(),
            'earnings' => (int) $v->bookings()->where('status', 'completed')->sum('host_earnings'),
            'host_name' => $v->host?->name,
        ];
    }

    public static function review(Review $r): array
    {
        return [
            'id' => $r->id,
            'rating' => $r->rating,
            'comment' => $r->comment,
            'renter' => ['name' => $r->renter?->name, 'initials' => self::initials($r->renter?->name ?? '?')],
            'created_at' => $r->created_at?->toIso8601String(),
        ];
    }

    public static function payment(Payment $p): array
    {
        return [
            'id' => $p->id,
            'type' => $p->type,
            'method' => $p->method,
            'method_label' => $p->method === 'deposit' ? 'Security deposit' : (PaymentGateway::METHODS[$p->method] ?? $p->method),
            'amount' => $p->amount,
            'status' => $p->status,
            'receipt_no' => $p->receipt_no,
            'gateway_ref' => $p->gateway_ref,
            'account_hint' => $p->account_hint,
            'description' => $p->description,
            'created_at' => $p->created_at?->toIso8601String(),
            'booking_reference' => $p->booking?->reference,
            'vehicle_name' => $p->booking?->vehicle?->name,
            'user' => $p->relationLoaded('user') ? self::userBrief($p->user) : null,
        ];
    }

    public static function incident(Incident $i): array
    {
        return [
            'id' => $i->id,
            'type' => $i->type,
            'description' => $i->description,
            'amount_claimed' => $i->amount_claimed,
            'amount_approved' => $i->amount_approved,
            'status' => $i->status,
            'resolution_notes' => $i->resolution_notes,
            'photo_ids' => $i->photo_ids ?? [],
            'reporter' => self::userBrief($i->reporter),
            'reporter_role' => $i->reporter_id === $i->booking?->host_id ? 'host' : ($i->reporter_id === $i->booking?->renter_id ? 'renter' : 'admin'),
            'created_at' => $i->created_at?->toIso8601String(),
            'resolved_at' => $i->resolved_at?->toIso8601String(),
            'booking' => $i->booking ? [
                'reference' => $i->booking->reference,
                'vehicle_name' => $i->booking->vehicle?->name,
                'renter' => self::userBrief($i->booking->renter),
                'host' => self::userBrief($i->booking->host),
                'protection_plan' => $i->booking->protection_plan,
                'liability_cap' => Protection::get($i->booking->protection_plan)['liability_cap'],
                'security_deposit' => $i->booking->security_deposit,
                'status' => $i->booking->status,
            ] : null,
        ];
    }

    public static function displayStatus(Booking $b): string
    {
        if ($b->status === 'confirmed') return 'upcoming';
        if ($b->status === 'completed' && $b->deposit_status === 'on_hold') return 'under_review';
        return $b->status;
    }

    public static function booking(Booking $b, string $viewer = 'renter'): array
    {
        $b->loadMissing(['vehicle.hub', 'vehicle.photos', 'renter', 'host', 'payments.booking', 'inspections', 'incidents.reporter', 'review']);
        $plan = Protection::get($b->protection_plan);
        $service = app(BookingService::class);
        $data = [
            'id' => $b->id,
            'reference' => $b->reference,
            'status' => $b->status,
            'display_status' => self::displayStatus($b),
            'payment_status' => $b->payment_status,
            'deposit_status' => $b->deposit_status,
            'pickup_at' => $b->pickup_at->toIso8601String(),
            'return_at' => $b->return_at->toIso8601String(),
            'actual_pickup_at' => $b->actual_pickup_at?->toIso8601String(),
            'actual_return_at' => $b->actual_return_at?->toIso8601String(),
            'rental_type' => $b->rental_type,
            'protection' => $plan,
            'days' => $b->days,
            'daily_rate' => $b->daily_rate,
            'rental_subtotal' => $b->rental_subtotal,
            'driver_fee_total' => $b->driver_fee_total,
            'protection_total' => $b->protection_total,
            'service_fee' => $b->service_fee,
            'total' => $b->total,
            'security_deposit' => $b->security_deposit,
            'amount_paid' => $b->amount_paid,
            'late_hours' => $b->late_hours,
            'late_fee' => $b->late_fee,
            'damage_charge' => $b->damage_charge,
            'balance_due' => $b->balance_due,
            'deposit_refunded' => $b->deposit_refunded,
            'pickup_label' => $b->pickup_label,
            'pickup_lat' => $b->pickup_lat,
            'pickup_lng' => $b->pickup_lng,
            'driver' => ['name' => $b->driver_name, 'phone' => $b->driver_phone, 'email' => $b->driver_email, 'license_no' => $b->driver_license_no],
            'payment_method' => $b->payment_method,
            'payment_method_label' => PaymentGateway::METHODS[$b->payment_method] ?? $b->payment_method,
            'agreement' => ['version' => $b->agreement_version, 'accepted_at' => $b->agreement_accepted_at?->toIso8601String()],
            'cancelled_at' => $b->cancelled_at?->toIso8601String(),
            'cancelled_by' => $b->cancelled_by,
            'cancel_reason' => $b->cancel_reason,
            'can_cancel' => $service->canRenterCancel($b),
            'free_cancellation_until' => $b->pickup_at->copy()->subHours((int) Settings::get('cancellation_cutoff_hours'))->toIso8601String(),
            'can_review' => $b->status === 'completed' && ! $b->review,
            'review' => $b->review ? self::review($b->review) : null,
            'vehicle' => self::vehicleCard($b->vehicle),
            'renter' => self::userBrief($b->renter),
            'host' => self::userBrief($b->host),
            'payments' => $b->payments->map(fn ($p) => self::payment($p))->values(),
            'inspections' => $b->inspections->map(fn ($i) => [
                'stage' => $i->stage, 'odometer' => $i->odometer, 'fuel_level' => $i->fuel_level,
                'checklist' => $i->checklist, 'notes' => $i->notes, 'created_at' => $i->created_at?->toIso8601String(),
            ])->values(),
            'incidents' => $b->incidents->map(fn ($i) => [
                'id' => $i->id, 'type' => $i->type, 'description' => $i->description, 'status' => $i->status,
                'amount_claimed' => $i->amount_claimed, 'amount_approved' => $i->amount_approved,
                'resolution_notes' => $i->resolution_notes, 'created_at' => $i->created_at?->toIso8601String(),
                'reporter_role' => $i->reporter_id === $b->host_id ? 'host' : ($i->reporter_id === $b->renter_id ? 'renter' : 'admin'),
            ])->values(),
            'created_at' => $b->created_at?->toIso8601String(),
            'invoice_no' => 'INV-'.$b->created_at?->format('Y').'-'.str_pad((string) $b->id, 5, '0', STR_PAD_LEFT),
        ];
        if ($viewer !== 'renter') {
            $data['commission'] = $b->commission ?: (int) round(($b->rental_subtotal + $b->driver_fee_total) * Settings::get('commission_rate') / 100);
            $data['host_earnings'] = $b->host_earnings ?: ($b->rental_subtotal + $b->driver_fee_total - $data['commission']);
            $data['payout'] = $b->payout ? $b->payout->only(['amount', 'status', 'paid_at']) + ['scheduled_for' => $b->payout->scheduled_for?->toDateString()] : null;
        }
        if ($viewer === 'admin') {
            $data['admin_note'] = $b->admin_note;
            $data['refundable'] = $service->refundableAmount($b);
            $data['events'] = $b->events()->with('actor')->get()->map(fn ($e) => [
                'type' => $e->type, 'message' => $e->message, 'actor' => $e->actor?->name ?? 'System', 'created_at' => $e->created_at?->toIso8601String(),
            ])->values();
            $data['commission_rate'] = Settings::get('commission_rate');
        }
        return $data;
    }

    public static function bookingRow(Booking $b): array
    {
        return [
            'id' => $b->id,
            'reference' => $b->reference,
            'status' => $b->status,
            'display_status' => self::displayStatus($b),
            'payment_status' => $b->payment_status,
            'deposit_status' => $b->deposit_status,
            'pickup_at' => $b->pickup_at->toIso8601String(),
            'return_at' => $b->return_at->toIso8601String(),
            'days' => $b->days,
            'total' => $b->total,
            'amount_paid' => $b->amount_paid,
            'balance_due' => $b->balance_due,
            'host_earnings' => $b->host_earnings ?: ($b->rental_subtotal + $b->driver_fee_total - (int) round(($b->rental_subtotal + $b->driver_fee_total) * Settings::get('commission_rate') / 100)),
            'pickup_label' => $b->pickup_label,
            'rental_type' => $b->rental_type,
            'vehicle' => $b->vehicle ? self::vehicleCard($b->vehicle) : null,
            'renter' => self::userBrief($b->renter),
            'host' => self::userBrief($b->host),
            'has_open_incident' => $b->relationLoaded('incidents') ? $b->incidents->where('status', 'open')->isNotEmpty() : false,
            'can_cancel' => app(BookingService::class)->canRenterCancel($b),
            'can_review' => $b->status === 'completed' && ! ($b->relationLoaded('review') ? $b->review : $b->review()->exists()),
            'created_at' => $b->created_at?->toIso8601String(),
        ];
    }

    public static function license(?DriverLicense $l, bool $admin = false, bool $withChecks = true): ?array
    {
        if (! $l) return null;
        $data = [
            'id' => $l->id,
            'license_type' => $l->license_type,
            'license_number' => $l->license_number,
            'full_name' => $l->full_name,
            'birthdate' => $l->birthdate?->toDateString(),
            'expiry_date' => $l->expiry_date?->toDateString(),
            'address' => $l->address,
            'nationality' => $l->nationality,
            'restriction_codes' => $l->restriction_codes ?? [],
            'status' => $l->status,
            'rejection_reason' => $l->rejection_reason,
            'submitted_at' => $l->created_at?->toIso8601String(),
            'reviewed_at' => $l->reviewed_at?->toIso8601String(),
        ];
        if ($admin) {
            $data += [
                'auto_score' => $l->auto_score,
                'auto_label' => $l->auto_label,
                'auto_decision' => $l->auto_decision,
                'decision_source' => $l->decision_source,
                'auto_decision_reason' => $l->auto_decision_reason,
                'auto_decided_at' => $l->auto_decided_at?->toIso8601String(),
                'override' => $l->overridden_at ? ['by' => $l->overrider?->name, 'at' => $l->overridden_at->toIso8601String(), 'note' => $l->override_note] : null,
                'decisions' => $withChecks ? $l->decisions->map(fn ($d) => [
                    'id' => $d->id, 'event' => $d->event, 'outcome' => $d->outcome, 'reason' => $d->reason, 'triggers' => $d->triggers ?? [],
                    'checks' => $d->checks ?? [], 'scores' => $d->scores ?? [], 'settings' => $d->settings ?? [],
                    'actor' => $d->actor?->name, 'created_at' => $d->created_at?->toIso8601String(),
                ])->all() : null,
                'auto_checks' => $l->auto_checks ?? [],
                // Reported by the renter's browser: supporting evidence for the admin, not proof.
                'client_checks' => $withChecks ? $l->client_checks : null,
                'front_media_id' => $l->front_media_id,
                'back_media_id' => $l->back_media_id,
                'selfie_media_id' => $l->selfie_media_id,
                'user' => self::userBrief($l->user),
                'reviewer' => $l->reviewer?->name,
            ];
        }
        return $data;
    }

    public static function hostApplication(?HostApplication $a, bool $admin = false): ?array
    {
        if (! $a) return null;
        $digits = preg_replace('/\D/', '', $a->payout_account_number);
        return [
            'id' => $a->id,
            'full_name' => $a->full_name,
            'phone' => $a->phone,
            'city' => $a->city,
            'address' => $a->address,
            'vehicle_count' => $a->vehicle_count,
            'vehicle_types' => $a->vehicle_types ?? [],
            'business_name' => $a->business_name,
            'payout_method' => $a->payout_method,
            'payout_account_name' => $a->payout_account_name,
            'payout_account_masked' => '•••• '.substr($digits, -4),
            'notes' => $a->notes,
            'status' => $a->status,
            'admin_notes' => $a->admin_notes,
            'submitted_at' => $a->created_at?->toIso8601String(),
            'reviewed_at' => $a->reviewed_at?->toIso8601String(),
            'user' => $admin ? self::userBrief($a->user) : null,
        ];
    }

    public static function paginated($paginator, callable $map): array
    {
        return [
            'data' => collect($paginator->items())->map($map)->values(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
        ];
    }
}
