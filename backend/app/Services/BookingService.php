<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Incident;
use App\Models\Payment;
use App\Models\Payout;
use App\Models\User;
use App\Models\Vehicle;
use App\Support\Money;
use App\Support\Notifier;
use App\Support\Settings;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BookingService
{
    public const AGREEMENT_VERSION = AgreementService::VERSION;

    public function __construct(protected PricingService $pricing, protected PaymentService $payments, protected AgreementService $agreements) {}

    public static function receiptNo(string $prefix = 'OR'): string
    {
        return PaymentService::receiptNo($prefix);
    }

    public static function nextReference(): string
    {
        $n = 20400 + (int) Booking::max('id') + 1;
        while (Booking::where('reference', 'BG-'.$n)->exists()) $n++;
        return 'BG-'.$n;
    }

    /**
     * $data must carry what the renter e-signed: `signature_name` (typed, must match the verified name) and
     * `agreement_hash` (the hash of the agreement text they were shown).
     */
    public function create(User $renter, Vehicle $vehicle, array $data, ?string $ip = null, ?string $userAgent = null): Booking
    {
        $pickup = Carbon::parse($data['pickup_at']);
        $return = Carbon::parse($data['return_at']);
        $rentalType = $data['rental_type'] ?? 'self';

        if ($renter->isSuspended()) {
            throw ValidationException::withMessages(['account' => 'Your account is currently on hold. Please contact support.']);
        }
        if ($vehicle->host_id === $renter->id) {
            throw ValidationException::withMessages(['vehicle' => 'You can\'t book your own vehicle.']);
        }
        if ($vehicle->status !== 'live' || $vehicle->host?->isSuspended()) {
            throw ValidationException::withMessages(['vehicle' => 'This vehicle isn\'t accepting bookings right now.']);
        }
        if ($rentalType === 'self' && ! $renter->isVerified()) {
            throw ValidationException::withMessages(['verification' => 'Please verify your driver\'s license before booking a self-drive trip.']);
        }

        $booking = DB::transaction(function () use ($renter, $vehicle, $data, $pickup, $return, $rentalType, $ip, $userAgent) {
            // Lock the vehicle row so two renters can't grab the same dates at once.
            $vehicle = Vehicle::whereKey($vehicle->id)->lockForUpdate()->firstOrFail();
            if (! $vehicle->isFreeBetween($pickup, $return)) {
                throw ValidationException::withMessages(['pickup_at' => 'Sorry, someone just booked these dates. Please pick different dates.']);
            }
            $quote = $this->pricing->quote($vehicle, $pickup, $return, $rentalType, $data['protection_plan'] ?? 'standard');

            // E-signature: the typed name must be the verified name, and the text must be the text they were shown.
            $agreement = $this->agreements->build($vehicle, $renter, $quote, $pickup, $return, $rentalType);
            if (! $this->agreements->namesMatch((string) ($data['signature_name'] ?? ''), $agreement['signer_name'])) {
                throw ValidationException::withMessages(['signature_name' => 'Type your full name exactly as it appears on your verified license: '.$agreement['signer_name'].'.']);
            }
            if (! hash_equals($agreement['hash'], (string) ($data['agreement_hash'] ?? ''))) {
                throw ValidationException::withMessages(['agreement' => 'The agreement changed since you opened it (for example the price or dates). Please read it again and sign.']);
            }

            $booking = Booking::create([
                'reference' => self::nextReference(),
                'renter_id' => $renter->id,
                'vehicle_id' => $vehicle->id,
                'host_id' => $vehicle->host_id,
                'pickup_at' => $pickup,
                'return_at' => $return,
                'rental_type' => $rentalType,
                'protection_plan' => $quote['protection_plan'],
                'days' => $quote['days'],
                'daily_rate' => $quote['daily_rate'],
                'rental_subtotal' => $quote['rental_subtotal'],
                'driver_fee_total' => $quote['driver_fee_total'],
                'protection_total' => $quote['protection_total'],
                'service_fee' => $quote['service_fee'],
                'total' => $quote['total'],
                'security_deposit' => $quote['security_deposit'],
                'amount_paid' => 0,
                // Nothing is confirmed until Xendit says the payment went through (see PaymentService::confirm). Until then the dates are held.
                'status' => 'pending',
                'payment_status' => 'unpaid',
                'deposit_status' => 'pending',
                'expires_at' => now()->addMinutes((int) Settings::get('pending_booking_minutes')),
                // The booking keeps the exact pick-up spot; it is only shown to the renter and host (see Present::booking).
                'pickup_label' => $vehicle->pickupLabel(true),
                'pickup_lat' => $vehicle->lat,
                'pickup_lng' => $vehicle->lng,
                'driver_name' => $data['driver_name'] ?? $renter->name,
                'driver_phone' => $data['driver_phone'] ?? $renter->phone,
                'driver_email' => $data['driver_email'] ?? $renter->email,
                'driver_license_no' => $rentalType === 'self' ? ($renter->latestLicense?->license_number) : null,
                'payment_method' => $data['payment_method'],
                'agreement_accepted_at' => now(),
                'agreement_version' => $agreement['version'],
                'agreement_ip' => $ip,
            ]);
            $this->agreements->sign($booking, $agreement, trim((string) $data['signature_name']), $ip, $userAgent, (bool) ($data['agreement_read_to_end'] ?? false));

            $booking->log('created', 'Booking started. Rental agreement v'.$agreement['version'].' e-signed by '.trim((string) $data['signature_name']).'. Waiting for payment.', $renter->id);

            return $booking;
        });

        // The payment page is opened outside the transaction (it is a call to another company). If it can't be opened the
        // booking is dropped so the dates don't stay held for nothing.
        try {
            $this->payments->startCheckout($booking->load('vehicle'), $data['payment_method']);
        } catch (PaymentGatewayException $e) {
            $booking->update(['status' => 'cancelled', 'cancelled_at' => now(), 'cancelled_by' => 'system', 'cancel_reason' => 'The payment page could not be opened.', 'expires_at' => null]);
            $booking->log('cancelled', 'Payment could not be started, so the booking was dropped.');
            throw ValidationException::withMessages(['payment' => 'We couldn\'t open the payment page just now. Nothing was charged. Please try again in a moment.']);
        }
        return $booking->fresh();
    }

    public function freeCancellationUntil(Booking $booking): Carbon
    {
        return $booking->pickup_at->copy()->subHours((int) Settings::get('cancellation_cutoff_hours'));
    }

    public function canRenterCancel(Booking $booking): bool
    {
        return $booking->status === 'confirmed' && now()->lessThanOrEqualTo($this->freeCancellationUntil($booking));
    }

    /** Unpaid pending bookings stop holding the dates once their hold runs out. */
    public function expirePending(): int
    {
        $n = 0;
        Booking::where('status', 'pending')->where('expires_at', '<=', now())->each(function (Booking $b) use (&$n) {
            $b->update(['status' => 'cancelled', 'cancelled_at' => now(), 'cancelled_by' => 'system', 'cancel_reason' => 'Payment was not completed in time.', 'expires_at' => null]);
            $b->log('cancelled', 'Booking expired because payment was not completed in time. The dates are free again.');
            Notifier::send($b->renter_id, 'Booking expired', "Booking {$b->reference} expired because payment wasn't completed. You can book again any time.", '/vehicles', 'warning');
            $n++;
        });
        return $n;
    }

    /** A completed trip whose deposit was never settled (for example the settle step failed) is settled once the release window passes. */
    public function releaseDueDeposits(): int
    {
        $n = 0;
        $cutoff = now()->subDays((int) Settings::get('deposit_release_days'));
        Booking::where('status', 'completed')->where('deposit_status', 'held')->whereNull('settled_at')->where('actual_return_at', '<=', $cutoff)
            ->each(function (Booking $b) use (&$n) {
                $this->settle($b);
                $n++;
            });
        return $n;
    }

    public function cancel(Booking $booking, string $by, ?string $reason, ?User $actor = null, bool $refund = true): Booking
    {
        if ($booking->status === 'pending') return $this->dropUnpaid($booking, $by, $reason, $actor);
        if (! in_array($booking->status, ['confirmed', 'active'], true)) {
            throw ValidationException::withMessages(['booking' => 'This booking can no longer be cancelled.']);
        }
        if ($by === 'renter' && ! $this->canRenterCancel($booking)) {
            $hours = (int) Settings::get('cancellation_cutoff_hours');
            throw ValidationException::withMessages(['booking' => "Trips can be cancelled up to {$hours} hours (a day) before pick-up. Please contact support for help."]);
        }

        return DB::transaction(function () use ($booking, $by, $reason, $actor, $refund) {
            $booking->update([
                'status' => 'cancelled',
                'cancelled_at' => now(),
                'cancelled_by' => $by,
                'cancel_reason' => $reason,
            ]);
            $booking->log('cancelled', 'Booking cancelled by '.$by.($reason ? ": {$reason}" : '.'), $actor?->id);

            if ($by === 'host') {
                User::whereKey($booking->host_id)->increment('host_cancellations');
                Notifier::admins('Host cancelled a booking', "{$booking->host->name} cancelled {$booking->reference}. This is their ".$this->ordinal((int) $booking->host->fresh()->host_cancellations).' cancellation.', "/admin/bookings/{$booking->reference}", 'warning');
            }

            if ($refund) {
                // Only an in-time cancellation by the renter can carry the (optional) platform fee. Host, admin and system cancellations are always free.
                $fee = $by === 'renter' ? min((int) Settings::get('cancellation_fee'), (int) $booking->total, $this->refundableAmount($booking)) : 0;
                if ($fee > 0) {
                    $booking->payments()->create([
                        'user_id' => $booking->renter_id, 'type' => 'cancellation_fee', 'method' => $booking->payment_method, 'amount' => $fee, 'status' => 'succeeded',
                        'receipt_no' => self::receiptNo(), 'description' => "Cancellation fee for {$booking->reference}, kept from your payment",
                    ]);
                    $booking->update(['cancellation_fee' => $fee]);
                    $booking->log('fee', 'Cancellation fee of '.Money::peso($fee).' kept from the payment.', $actor?->id);
                }
                $refundable = $this->refundableAmount($booking);
                if ($refundable > 0) {
                    $this->issueRefund($booking, $refundable, ($fee > 0 ? 'Refund (minus cancellation fee) for cancelled trip ' : 'Full refund for cancelled trip ').$booking->reference, $actor, 'CANCELLATION');
                }
                $booking->update(['deposit_status' => 'refunded', 'payment_status' => $fee > 0 ? 'partially_refunded' : 'refunded']);
            }

            Notifier::send($booking->renter_id, 'Trip cancelled', "Your booking {$booking->reference} was cancelled.".($refund ? ' Your refund is on its way to your original payment method.' : ''), "/account/trips/{$booking->reference}", 'warning');
            Notifier::send($booking->host_id, 'Booking cancelled', "Booking {$booking->reference} for your {$booking->vehicle->name} was cancelled.", "/host/bookings/{$booking->reference}", 'warning');

            return $booking->fresh();
        });
    }

    /** Giving up before paying: the payment page is closed and the dates are free again. If the money lands anyway it is refunded. */
    protected function dropUnpaid(Booking $booking, string $by, ?string $reason, ?User $actor): Booking
    {
        $booking = $this->payments->verifyBooking($booking); // it may have been paid a second ago
        if ($booking->status !== 'pending') return $this->cancel($booking, $by, $reason, $actor);
        foreach ($booking->payments()->where('type', 'charge')->where('status', 'pending')->get() as $p) {
            if ($p->provider_session_id) app(PaymentGateway::class)->cancelSession($p->provider_session_id);
            $p->update(['status' => 'failed', 'failure_reason' => 'The booking was cancelled before paying.']);
        }
        $booking->update(['status' => 'cancelled', 'cancelled_at' => now(), 'cancelled_by' => $by, 'cancel_reason' => $reason, 'expires_at' => null]);
        $booking->log('cancelled', 'Unpaid booking cancelled by '.$by.($reason ? ": {$reason}" : '.'), $actor?->id);
        return $booking->fresh();
    }

    protected function ordinal(int $n): string
    {
        return $n.(in_array($n % 100, [11, 12, 13], true) ? 'th' : [1 => 'st', 2 => 'nd', 3 => 'rd'][$n % 10] ?? 'th');
    }

    public function refundableAmount(Booking $booking): int
    {
        return $this->payments->refundable($booking);
    }

    /** @return Payment the first refund row created (a refund is split only if it spans more than one payment) */
    public function issueRefund(Booking $booking, int $amount, string $description, ?User $actor = null, string $providerReason = 'OTHERS'): Payment
    {
        $rows = $this->payments->refund($booking, $amount, $description, $actor, $providerReason);
        // A refund Xendit refused is saved as failed (see Payments in the admin) and doesn't change the booking.
        if ($booking->status !== 'cancelled' && collect($rows)->contains(fn ($r) => $r->status !== 'failed')) {
            $booking->update(['payment_status' => 'partially_refunded']);
        }
        return $rows[0];
    }

    public function recordPickup(Booking $booking, array $data, User $actor): Booking
    {
        if ($booking->status !== 'confirmed') {
            throw ValidationException::withMessages(['booking' => 'Only upcoming trips can be marked as picked up.']);
        }
        if (now()->lessThan($booking->pickup_at->copy()->subHours(12))) {
            throw ValidationException::withMessages(['booking' => 'You can start the handover up to 12 hours before the pick-up time.']);
        }
        if (! $booking->inspections()->where('stage', 'checkin')->whereNotNull('submitted_at')->exists()) {
            throw ValidationException::withMessages(['booking' => 'The trip can\'t start until the renter submits the check-in photos in the app.']);
        }
        return DB::transaction(function () use ($booking, $data, $actor) {
            $booking->inspections()->create([
                'stage' => 'pickup',
                'odometer' => $data['odometer'],
                'fuel_level' => $data['fuel_level'],
                'checklist' => $data['checklist'] ?? [],
                'notes' => $data['notes'] ?? null,
                'photo_ids' => $data['photo_ids'] ?? [],
                'recorded_by' => $actor->id,
            ]);
            $booking->update(['status' => 'active', 'actual_pickup_at' => now()]);
            $booking->log('pickup', "Vehicle handed over. Odometer {$data['odometer']} km, fuel {$data['fuel_level']}%.", $actor->id);
            Notifier::send($booking->renter_id, 'Enjoy your trip!', "Your trip {$booking->reference} has started. Return by {$booking->return_at->format('M j, g:i A')} to avoid late fees.", "/account/trips/{$booking->reference}", 'success');
            return $booking->fresh();
        });
    }

    public function recordReturn(Booking $booking, array $data, User $actor): Booking
    {
        if ($booking->status !== 'active') {
            throw ValidationException::withMessages(['booking' => 'Only trips in progress can be marked as returned.']);
        }
        return DB::transaction(function () use ($booking, $data, $actor) {
            $actual = isset($data['actual_return_at']) ? Carbon::parse($data['actual_return_at']) : now();
            if ($actual->lessThan($booking->actual_pickup_at ?? $booking->pickup_at)) {
                throw ValidationException::withMessages(['actual_return_at' => 'Return time can\'t be before the pick-up time.']);
            }
            $booking->inspections()->create([
                'stage' => 'return',
                'odometer' => $data['odometer'],
                'fuel_level' => $data['fuel_level'],
                'checklist' => $data['checklist'] ?? [],
                'notes' => $data['notes'] ?? null,
                'photo_ids' => $data['photo_ids'] ?? [],
                'recorded_by' => $actor->id,
            ]);
            $late = $this->pricing->lateFee($booking->vehicle, $booking->return_at, $actual);
            $booking->update([
                'status' => 'completed',
                'actual_return_at' => $actual,
                'late_hours' => $late['hours'],
                'late_fee' => $late['fee'],
            ]);
            $booking->vehicle->increment('trips_count');
            $booking->log('return', "Vehicle returned. Odometer {$data['odometer']} km, fuel {$data['fuel_level']}%."
                .($late['fee'] > 0 ? " Returned {$late['hours']} hour(s) late – late fee ".Money::peso($late['fee']).'.' : ' Returned on time.'), $actor->id);

            if (! empty($data['damage_reported'])) {
                Incident::create([
                    'booking_id' => $booking->id,
                    'reporter_id' => $actor->id,
                    'type' => $data['damage_type'] ?? 'damage',
                    'description' => $data['damage_description'] ?? 'Damage found during return inspection.',
                    'amount_claimed' => (int) ($data['damage_amount'] ?? 0),
                    'photo_ids' => $data['photo_ids'] ?? [],
                    'pins' => $data['pins'] ?? null,
                ]);
                $booking->update(['deposit_status' => 'on_hold']);
                $booking->log('incident', 'Host reported an issue at return. Deposit stays on hold while our team reviews it.', $actor->id);
                Notifier::send($booking->renter_id, 'Your deposit is on hold', "Your host reported an issue after trip {$booking->reference}. Our team will review it within 48 hours.", "/account/trips/{$booking->reference}", 'warning');
                Notifier::admins('New damage claim', "Booking {$booking->reference} has a damage report to review.", '/admin/disputes', 'warning');
            } else {
                $this->settle($booking->fresh());
            }
            Notifier::send($booking->renter_id, 'Thanks for riding with ByaheGo', "Trip {$booking->reference} is complete. Leave a review to help other renters!", "/account/trips/{$booking->reference}", 'info');
            return $booking->fresh();
        });
    }

    /**
     * Settle the deposit after a trip: late fees and approved damages are deducted first, the rest goes back
     * to the renter. Anything above the deposit becomes a balance the renter pays from their trip page.
     */
    public function settle(Booking $booking, int $damage = 0, ?User $actor = null): Booking
    {
        $deposit = $booking->security_deposit;
        $charges = [];
        if ($booking->late_fee > 0) $charges['late_fee'] = $booking->late_fee;
        if ($damage > 0) $charges['damage'] = $damage;

        $remainingDeposit = $deposit;
        $balance = 0;
        foreach ($charges as $type => $amount) {
            $fromDeposit = min($amount, $remainingDeposit);
            $remainingDeposit -= $fromDeposit;
            $balance += $amount - $fromDeposit;
            if ($fromDeposit > 0) {
                $booking->payments()->create([
                    'user_id' => $booking->renter_id,
                    'type' => $type,
                    'method' => 'deposit',
                    'amount' => $fromDeposit,
                    'status' => 'succeeded',
                    'receipt_no' => self::receiptNo(),
                    'description' => ($type === 'late_fee' ? "Late return fee ({$booking->late_hours} h)" : 'Approved damage charge')." – deducted from deposit for {$booking->reference}",
                ]);
            }
        }
        if ($remainingDeposit > 0) {
            $this->payments->refund($booking, $remainingDeposit, "Security deposit returned for {$booking->reference}", $actor);
        }

        $commission = (int) round(($booking->rental_subtotal + $booking->driver_fee_total) * Settings::get('commission_rate') / 100);
        $hostEarnings = $booking->rental_subtotal + $booking->driver_fee_total - $commission + $booking->late_fee + $damage;
        $depositStatus = $remainingDeposit === $deposit ? 'released' : ($remainingDeposit > 0 ? 'partially_released' : 'applied');

        $booking->update([
            'damage_charge' => $damage,
            'deposit_refunded' => $remainingDeposit,
            'balance_due' => $balance,
            'deposit_status' => $depositStatus,
            'payment_status' => $balance > 0 ? 'balance_due' : 'paid',
            'commission' => $commission,
            'host_earnings' => $hostEarnings,
            'settled_at' => now(),
        ]);

        Payout::updateOrCreate(['booking_id' => $booking->id], [
            'host_id' => $booking->host_id,
            'amount' => $hostEarnings,
            'status' => 'scheduled',
            'scheduled_for' => now()->addDays(3)->toDateString(),
        ]);

        $msg = $remainingDeposit > 0 ? Money::peso($remainingDeposit).' of your deposit is on its way back to you.' : 'Your deposit was used to cover trip charges.';
        if ($balance > 0) $msg .= ' A remaining balance of '.Money::peso($balance).' is due.';
        $booking->log('settled', 'Deposit settled. '.$msg, $actor?->id);
        Notifier::send($booking->renter_id, 'Deposit update', $msg, "/account/trips/{$booking->reference}", $balance > 0 ? 'warning' : 'success');

        return $booking->fresh();
    }

    /** Opens a hosted checkout for the balance. The balance is cleared only when Xendit confirms the payment. */
    public function payBalance(Booking $booking, string $method): Payment
    {
        if ($booking->balance_due <= 0) {
            throw ValidationException::withMessages(['booking' => 'There is no balance due on this trip.']);
        }
        foreach ($booking->payments()->where('type', 'balance')->where('status', 'pending')->get() as $old) $this->payments->verify($old);
        if ($booking->fresh()->balance_due <= 0) {
            throw ValidationException::withMessages(['booking' => 'There is no balance due on this trip.']);
        }
        try {
            return $this->payments->startCheckout($booking->load('vehicle'), $method, 'balance');
        } catch (PaymentGatewayException) {
            throw ValidationException::withMessages(['payment' => 'We couldn\'t open the payment page just now. Nothing was charged. Please try again in a moment.']);
        }
    }

    public function resolveIncident(Incident $incident, string $action, int $amount, ?string $notes, bool $suspendRenter, User $admin): Incident
    {
        if ($incident->status !== 'open') {
            throw ValidationException::withMessages(['incident' => 'This case has already been closed.']);
        }
        return DB::transaction(function () use ($incident, $action, $amount, $notes, $suspendRenter, $admin) {
            $booking = $incident->booking;
            $incident->update([
                'status' => $action === 'charge' ? 'resolved' : 'dismissed',
                'amount_approved' => $action === 'charge' ? $amount : 0,
                'resolution_notes' => $notes,
                'resolved_by' => $admin->id,
                'resolved_at' => now(),
            ]);
            $booking->log('incident', $action === 'charge'
                ? 'Claim approved: renter charged '.Money::peso($amount).'.'
                : 'Claim dismissed by our team.', $admin->id);

            if ($booking->status === 'completed' && $booking->settled_at === null) {
                $openLeft = $booking->incidents()->where('status', 'open')->exists();
                if (! $openLeft) {
                    $totalApproved = (int) $booking->incidents()->where('status', 'resolved')->sum('amount_approved');
                    $this->settle($booking->fresh(), $totalApproved, $admin);
                }
            } elseif ($action === 'charge' && $amount > 0 && $booking->settled_at !== null) {
                // Trip was already settled: add the charge as a balance to pay.
                $booking->update(['balance_due' => $booking->balance_due + $amount, 'payment_status' => 'balance_due', 'damage_charge' => $booking->damage_charge + $amount]);
                Notifier::send($booking->renter_id, 'Balance due', 'A charge of '.Money::peso($amount)." was added to {$booking->reference} after review.", "/account/trips/{$booking->reference}", 'warning');
            }

            if ($suspendRenter) {
                $renter = $booking->renter;
                app(AccountStatusService::class)->suspend($renter, $admin, 'Account on hold after incident on '.$booking->reference, null);
            }
            Notifier::send($incident->reporter_id, 'Your report was reviewed', $action === 'charge' ? 'We approved the claim of '.Money::peso($amount).'.' : 'We reviewed your report and closed it.', null, 'info');
            return $incident->fresh();
        });
    }
}
