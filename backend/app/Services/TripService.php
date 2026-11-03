<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\BookingExtension;
use App\Models\Incident;
use App\Models\Inspection;
use App\Models\InspectionPhoto;
use App\Models\Media;
use App\Models\Payment;
use App\Models\User;
use App\Support\Money;
use App\Support\Notifier;
use App\Support\Settings;
use Carbon\Carbon;
use finfo;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

/**
 * Everything that happens during a trip: the renter's guided check-in and check-out photos, the host's review,
 * return-time extensions, the excess-hours calculation, reminders and the "car not returned" report.
 * Nobody here decides about money automatically: a person (host or admin) always makes the call.
 */
class TripService
{
    /** The shots every check-in and check-out needs, in the order the guided camera asks for them. */
    public const ANGLES = [
        'front' => 'Front',
        'rear' => 'Rear',
        'driver_side' => 'Driver side',
        'passenger_side' => 'Passenger side',
        'dashboard' => 'Dashboard and front seats',
        'back_seats' => 'Back seats',
        'trunk' => 'Trunk with spare tire and tools',
        'engine' => 'Engine bay (hood open)',
        'odometer' => 'Odometer',
        'fuel' => 'Fuel gauge',
    ];

    /** Optional close-ups of damage (renter) and extra photos added by the host. These can still be added after submitting. */
    public const EXTRA_ANGLES = ['damage' => 'Damage close-up', 'host_extra' => 'Host photo'];

    /** E, ¼, ½, ¾, F as a percentage. */
    public const FUEL_LEVELS = [0, 25, 50, 75, 100];

    public const MAX_EXTENSION_DAYS = 7;

    public function __construct(protected PricingService $pricing, protected BookingService $bookings, protected AccountStatusService $accounts, protected PaymentService $payments) {}

    // ---------------------------------------------------------------- who can do what

    public function checkinOpens(Booking $b): bool
    {
        return $b->status === 'confirmed' && now()->greaterThanOrEqualTo($b->pickup_at->copy()->subHours(12));
    }

    public function inspection(Booking $b, string $stage): ?Inspection
    {
        return $b->inspections()->where('stage', $stage)->whereNotNull('submitted_at')->first();
    }

    protected function assertRenterCanInspect(Booking $b, string $stage): void
    {
        if ($stage === 'checkin') {
            if ($b->status !== 'confirmed') throw ValidationException::withMessages(['booking' => 'Check-in photos are taken before the trip starts.']);
            if (! $this->checkinOpens($b)) throw ValidationException::withMessages(['booking' => 'Check-in opens 12 hours before pick-up ('.$b->pickup_at->copy()->subHours(12)->timezone('Asia/Manila')->format('M j, g:i A').').']);
        } else {
            if ($b->status !== 'active') throw ValidationException::withMessages(['booking' => 'Return photos are taken during the trip.']);
            if (! $this->inspection($b, 'checkin')) throw ValidationException::withMessages(['booking' => 'This trip has no check-in photos to compare with.']);
        }
    }

    // ---------------------------------------------------------------- photos

    /**
     * Saves one photo as a draft (renter) or as an extra photo (host, or a renter's damage close-up after submitting).
     * Photos are private: they are served only to the renter, the host and admins (see MediaController::show).
     */
    public function storePhoto(Booking $b, User $user, string $stage, UploadedFile $file, array $meta): InspectionPhoto
    {
        $angle = (string) ($meta['angle'] ?? '');
        $isHost = $user->id === $b->host_id;
        if (! $isHost && $user->id !== $b->renter_id) abort(404);

        $submitted = $this->inspection($b, $stage);
        if ($isHost) {
            // The host only adds to the renter's check-in, and only during the review window.
            if ($stage !== 'checkin' || ! $submitted) throw ValidationException::withMessages(['booking' => 'You can add photos once the renter has submitted the check-in.']);
            if (! in_array($b->status, ['confirmed', 'active'], true) || $this->hostWindowClosed($submitted)) throw ValidationException::withMessages(['booking' => 'The window to add check-in photos has closed.']);
            $angle = 'host_extra';
        } else {
            $this->assertRenterCanInspect($b, $stage);
            if (! array_key_exists($angle, self::ANGLES) && $angle !== 'damage') throw ValidationException::withMessages(['angle' => 'Unknown photo angle.']);
            if ($submitted && $angle !== 'damage') throw ValidationException::withMessages(['booking' => 'This step is already submitted. You can only add damage close-ups now.']);
        }

        $contents = (string) file_get_contents($file->getRealPath());
        $size = @getimagesizefromstring($contents);
        $mime = $size ? (new finfo(FILEINFO_MIME_TYPE))->buffer($contents) : null;
        if (! $size || ! in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true) || $mime !== $size['mime']) {
            throw ValidationException::withMessages(['file' => 'We couldn\'t read that photo. Please take it again.']);
        }
        if ($size[0] * $size[1] > 16_000_000 || min($size[0], $size[1]) < 200) {
            throw ValidationException::withMessages(['file' => 'That photo is the wrong size. Please take it again with the camera.']);
        }

        return DB::transaction(function () use ($b, $user, $stage, $angle, $contents, $mime, $size, $meta, $submitted, $isHost) {
            if (! $isHost && ! $submitted && $angle !== 'damage') {
                // Retaking a shot replaces the draft of that angle. Only drafts can be replaced; submitted photos never change.
                $b->inspectionPhotos()->where('stage', $stage)->where('angle', $angle)->whereNull('inspection_id')->where('uploader_id', $user->id)->delete();
            }
            if ($angle === 'damage' && $b->inspectionPhotos()->where('stage', $stage)->where('angle', 'damage')->where('uploader_id', $user->id)->count() >= 10) {
                throw ValidationException::withMessages(['angle' => 'You can add up to 10 damage close-ups.']);
            }
            $media = Media::create([
                'user_id' => $user->id, 'purpose' => 'inspection', 'visibility' => 'private', 'mime' => $mime, 'size' => strlen($contents),
                'width' => $size[0], 'height' => $size[1], 'sha1' => sha1($contents), 'data' => base64_encode($contents),
            ]);
            $photo = $b->inspectionPhotos()->create([
                'inspection_id' => $submitted?->id, // an extra photo on a submitted inspection joins it straight away
                'stage' => $stage, 'angle' => $angle, 'media_id' => $media->id, 'uploader_id' => $user->id,
                'live' => (bool) ($meta['live'] ?? false),
                'device_time' => isset($meta['device_time']) ? Carbon::parse($meta['device_time']) : null,
                'lat' => $meta['lat'] ?? null, 'lng' => $meta['lng'] ?? null,
                'sha256' => hash('sha256', $contents),
                'note' => isset($meta['note']) ? mb_substr((string) $meta['note'], 0, 255) : null,
            ]);
            if ($submitted) {
                $photoIds = array_merge($submitted->photo_ids ?? [], [$media->id]);
                $submitted->update(['photo_ids' => $photoIds]);
                $b->log('inspection', ($isHost ? 'Host' : 'Renter').' added a photo to the '.$stage.'.', $user->id);
            }
            return $photo;
        });
    }

    public function deleteDraft(Booking $b, User $user, int $photoId): void
    {
        $photo = $b->inspectionPhotos()->whereKey($photoId)->where('uploader_id', $user->id)->whereNull('inspection_id')->first();
        if (! $photo) throw ValidationException::withMessages(['photo' => 'Only a photo you haven\'t submitted yet can be removed.']);
        $mediaId = $photo->media_id;
        $photo->delete();
        Media::whereKey($mediaId)->delete();
    }

    /** What the guided camera needs: the shots, the drafts so far and, at check-out, the matching check-in photo to overlay. */
    public function wizard(Booking $b, string $stage): array
    {
        $drafts = $b->inspectionPhotos()->where('stage', $stage)->whereNull('inspection_id')->get();
        $checkin = $this->inspection($b, 'checkin');
        $ghosts = $stage === 'checkout' && $checkin
            ? $b->inspectionPhotos()->where('stage', 'checkin')->where('inspection_id', $checkin->id)->whereIn('angle', array_keys(self::ANGLES))->get()->mapWithKeys(fn ($p) => [$p->angle => $p->media_id])
            : collect();
        $done = $this->inspection($b, $stage);
        return [
            'stage' => $stage,
            'angles' => collect(self::ANGLES)->map(fn ($label, $key) => ['key' => $key, 'label' => $label])->values(),
            'drafts' => $drafts->map(fn ($p) => ['id' => $p->id, 'angle' => $p->angle, 'media_id' => $p->media_id, 'live' => $p->live, 'note' => $p->note])->values(),
            'ghosts' => $ghosts,
            'checkin_odometer' => $checkin?->odometer,
            'checkin_fuel_level' => $checkin?->fuel_level,
            'submitted' => (bool) $done,
            'can_start' => $stage === 'checkin' ? $this->checkinOpens($b) && ! $done : $b->status === 'active' && ! $done && (bool) $checkin,
            'opens_at' => $stage === 'checkin' ? $b->pickup_at->copy()->subHours(12)->toIso8601String() : null,
        ];
    }

    /** The renter finishes the check-in or check-out. Needs every shot, the odometer and the fuel level. */
    public function submit(Booking $b, User $renter, string $stage, array $data): Inspection
    {
        return DB::transaction(function () use ($b, $renter, $stage, $data) {
            $b = Booking::whereKey($b->id)->lockForUpdate()->firstOrFail();
            $this->assertRenterCanInspect($b, $stage);
            if ($this->inspection($b, $stage)) throw ValidationException::withMessages(['booking' => 'This step was already submitted.']);

            $drafts = $b->inspectionPhotos()->where('stage', $stage)->whereNull('inspection_id')->where('uploader_id', $renter->id)->get();
            $missing = collect(self::ANGLES)->reject(fn ($label, $key) => $drafts->contains('angle', $key))->values();
            if ($missing->isNotEmpty()) {
                throw ValidationException::withMessages(['photos' => 'Photos still needed: '.$missing->implode(', ').'.']);
            }
            if (! in_array((int) $data['fuel_level'], self::FUEL_LEVELS, true)) {
                throw ValidationException::withMessages(['fuel_level' => 'Choose E, ¼, ½, ¾ or F.']);
            }
            if ($stage === 'checkout') {
                $in = $this->inspection($b, 'checkin');
                if ((int) $data['odometer'] < (int) $in->odometer) {
                    throw ValidationException::withMessages(['odometer' => 'The odometer can\'t be lower than at check-in ('.number_format($in->odometer).' km).']);
                }
            }

            $inspection = $b->inspections()->create([
                'stage' => $stage, 'odometer' => (int) $data['odometer'], 'fuel_level' => (int) $data['fuel_level'], 'checklist' => [],
                'notes' => $data['notes'] ?? null, 'photo_ids' => $drafts->pluck('media_id')->all(), 'recorded_by' => $renter->id,
                'submitted_at' => now(), 'host_status' => $stage === 'checkin' ? 'pending' : null,
            ]);
            $b->inspectionPhotos()->whereIn('id', $drafts->pluck('id'))->update(['inspection_id' => $inspection->id]);

            if ($stage === 'checkin') {
                $hours = (int) Settings::get('checkin_host_window_hours');
                $b->log('inspection', "Check-in photos submitted ({$drafts->count()} photos, odometer {$inspection->odometer} km).", $renter->id);
                Notifier::send($b->host_id, 'Check-in photos are ready', "{$renter->name} photographed your {$b->vehicle->name}. Confirm the condition within {$hours} hours, or it is accepted automatically.", "/host/bookings/{$b->reference}", 'info');
            } else {
                $late = $this->pricing->lateFee($b->vehicle, $b->return_at, now());
                $b->update([
                    'checkout_submitted_at' => now(), 'actual_return_at' => now(), 'late_hours' => $late['hours'], 'late_fee' => $late['fee'],
                    'host_review_due_at' => now()->addHours((int) Settings::get('host_review_hours')),
                ]);
                $b->log('inspection', "Return photos submitted (odometer {$inspection->odometer} km)."
                    .($late['fee'] > 0 ? " Returned {$late['hours']} hour(s) late: excess fee ".Money::peso($late['fee']).'.' : ' Returned on time.'), $renter->id);
                Notifier::send($b->host_id, 'The car was returned', "{$renter->name} submitted the return photos for {$b->reference}. Please review them within ".(int) Settings::get('host_review_hours').' hours or the trip completes automatically.', "/host/bookings/{$b->reference}", 'warning');
            }
            return $inspection;
        });
    }

    // ---------------------------------------------------------------- host side of the check-in

    public function hostWindowClosed(Inspection $checkin): bool
    {
        return $checkin->submitted_at->copy()->addHours((int) Settings::get('checkin_host_window_hours'))->isPast();
    }

    public function hostConfirmCheckin(Booking $b, User $host, ?string $notes): Inspection
    {
        $in = $this->inspection($b, 'checkin');
        if (! $in) throw ValidationException::withMessages(['booking' => 'The renter has not submitted the check-in yet.']);
        if ($in->host_status !== 'pending') throw ValidationException::withMessages(['booking' => 'The check-in was already '.($in->host_status === 'confirmed' ? 'confirmed' : 'accepted').'.']);
        $in->update(['host_status' => 'confirmed', 'host_notes' => $notes, 'host_responded_at' => now()]);
        $b->log('inspection', 'Host confirmed the vehicle condition at check-in.'.($notes ? " Note: {$notes}" : ''), $host->id);
        Notifier::send($b->renter_id, 'Host confirmed the check-in', "Your host agrees with the condition recorded for {$b->reference}.", "/account/trips/{$b->reference}", 'success');
        return $in->fresh();
    }

    // ---------------------------------------------------------------- the host's decision on the return

    /** "All good": the trip completes and the deposit is settled. Uses the renter's check-out readings. */
    public function acceptReturn(Booking $b, User $actor, bool $auto = false): Booking
    {
        $out = $this->inspection($b, 'checkout');
        if ($b->status !== 'active' || ! $out) throw ValidationException::withMessages(['booking' => 'There are no return photos to accept yet.']);
        $b->log('return', $auto ? 'The host did not respond in time, so the return was accepted automatically.' : 'Host accepted the return: all good.', $actor->id);
        return $this->bookings->recordReturn($b, [
            'odometer' => $out->odometer, 'fuel_level' => $out->fuel_level, 'checklist' => [], 'photo_ids' => $out->photo_ids ?? [],
            'notes' => $auto ? 'Accepted automatically after the review window.' : 'Accepted by the host after the return photos.',
            'actual_return_at' => $b->actual_return_at?->toIso8601String(),
        ], $actor);
    }

    /** "Report an issue": a dispute opens with both photo sets and readings, and the deposit stays held for an admin to decide. */
    public function reportReturnIssue(Booking $b, User $host, array $issue): Booking
    {
        $out = $this->inspection($b, 'checkout');
        if ($b->status !== 'active' || ! $out) throw ValidationException::withMessages(['booking' => 'The renter has not submitted the return photos yet.']);
        return $this->bookings->recordReturn($b, [
            'odometer' => $out->odometer, 'fuel_level' => $out->fuel_level, 'checklist' => [], 'photo_ids' => $out->photo_ids ?? [],
            'notes' => 'Host reported an issue after the return photos.', 'actual_return_at' => $b->actual_return_at?->toIso8601String(),
            'damage_reported' => true, 'damage_type' => $issue['type'], 'damage_description' => $issue['description'],
            'damage_amount' => $issue['amount'] ?? 0, 'pins' => $issue['pins'] ?? null,
        ], $host);
    }

    // ---------------------------------------------------------------- extensions

    public function requestExtension(Booking $b, User $renter, Carbon $newReturn, ?string $note): BookingExtension
    {
        if ($b->status !== 'active' || $b->checkout_submitted_at) throw ValidationException::withMessages(['return_at' => 'You can ask for more time while the trip is running.']);
        if (now()->greaterThanOrEqualTo($b->return_at)) throw ValidationException::withMessages(['return_at' => 'The return time has passed. Contact your host or support.']);
        if ($newReturn->lessThanOrEqualTo($b->return_at)) throw ValidationException::withMessages(['return_at' => 'Pick a time later than the current return time.']);
        if ($newReturn->greaterThan($b->return_at->copy()->addDays(self::MAX_EXTENSION_DAYS))) throw ValidationException::withMessages(['return_at' => 'You can extend by up to '.self::MAX_EXTENSION_DAYS.' days at a time.']);
        if ($b->extensions()->whereIn('status', ['pending', 'awaiting_payment'])->exists()) throw ValidationException::withMessages(['return_at' => 'You already have an extension request open. Wait for your host, or pay for the one they approved.']);
        if (! $b->vehicle->isFreeBetween($b->return_at, $newReturn)) throw ValidationException::withMessages(['return_at' => 'The car is booked or blocked by someone else in that time.']);

        $e = $b->extensions()->create(['previous_return_at' => $b->return_at, 'requested_return_at' => $newReturn, 'note' => $note]);
        $b->log('extension', 'Renter asked to return later: '.$newReturn->timezone('Asia/Manila')->format('M j, g:i A').'.', $renter->id);
        Notifier::send($b->host_id, 'Extension request', "{$renter->name} asks to return {$b->vehicle->name} on {$newReturn->timezone('Asia/Manila')->format('M j, g:i A')}.", "/host/bookings/{$b->reference}", 'warning');
        return $e;
    }

    /**
     * The host decides. Declining ends it. Approving does NOT move the return time yet: it prices the extra time (same rule as excess hours,
     * full days at the daily rate), opens a Xendit payment for it, and the return time moves only once that payment is confirmed
     * (PaymentService::confirm). If it isn't paid before the original return time the extension lapses and normal late fees apply.
     */
    public function respondExtension(Booking $b, User $host, BookingExtension $e, bool $approve, ?string $note): BookingExtension
    {
        if ($e->status !== 'pending' || $e->booking_id !== $b->id) throw ValidationException::withMessages(['extension' => 'This request was already answered.']);
        $when = fn (Carbon $t) => $t->timezone('Asia/Manila')->format('M j, g:i A');

        if (! $approve) {
            $e->update(['status' => 'declined', 'responded_by' => $host->id, 'responded_at' => now(), 'note' => $note ?: $e->note]);
            $b->log('extension', 'Host declined the extension.', $host->id);
            Notifier::send($b->renter_id, 'Extension declined', "Your host declined the extension. Please return {$b->vehicle->name} by {$when($b->return_at)}.", "/account/trips/{$b->reference}", 'warning');
            return $e->fresh();
        }

        if ($b->status !== 'active' || $b->checkout_submitted_at || $b->return_at->isPast() || ! $b->return_at->equalTo($e->previous_return_at)) {
            throw ValidationException::withMessages(['extension' => 'It is too late to approve this one: the return time has passed or changed.']);
        }
        if (! $b->vehicle->isFreeBetween($b->return_at, $e->requested_return_at)) {
            throw ValidationException::withMessages(['extension' => 'That time is no longer free for this car.']);
        }

        $c = $this->pricing->extensionCharge($b->vehicle, $e->previous_return_at, $e->requested_return_at);
        $e->update(['amount' => $c['amount'], 'hours' => $c['hours'], 'responded_by' => $host->id, 'responded_at' => now(), 'note' => $note ?: $e->note, 'status' => $c['amount'] > 0 ? 'awaiting_payment' : 'approved']);

        if ($c['amount'] <= 0) { // a listing with no rate: nothing to pay, so it applies straight away
            $b->update(['return_at' => $e->requested_return_at, 'return_reminder_sent_at' => null]);
            $b->log('extension', "Host approved the new return time: {$when($e->requested_return_at)} (no charge).", $host->id);
            Notifier::send($b->renter_id, 'Extension approved', "New return time for {$b->reference}: {$when($e->requested_return_at)}.", "/account/trips/{$b->reference}", 'success');
            return $e->fresh();
        }

        $b->log('extension', "Host approved extra time until {$when($e->requested_return_at)}. Waiting for the renter to pay ".Money::peso($c['amount']).'.', $host->id);
        try {
            $payment = $this->payments->startCheckout($b, $this->extensionMethod($b), 'extension', $e);
            $e->update(['payment_id' => $payment->id]);
        } catch (PaymentGatewayException $ex) {
            Log::warning("Could not open the extension payment for {$b->reference}: ".$ex->getMessage()); // the renter can open it from the trip page
        }
        Notifier::send($b->renter_id, 'Extension approved: please pay', 'Your host approved more time until '.$when($e->requested_return_at).'. Pay '.Money::peso($c['amount'])." before {$when($e->previous_return_at)} to confirm it. After that it lapses and normal late fees apply.", "/account/trips/{$b->reference}", 'warning');
        return $e->fresh();
    }

    protected function extensionMethod(Booking $b): string
    {
        return array_key_exists($b->payment_method, PaymentGateway::METHODS) ? $b->payment_method : 'gcash';
    }

    /** The renter opens (or reopens) the payment page for an approved extension. */
    public function payExtension(Booking $b, ?string $method): Payment
    {
        $e = $b->extensions()->where('status', 'awaiting_payment')->first();
        if (! $e) throw ValidationException::withMessages(['extension' => 'There is no approved extension waiting for payment.']);
        if (now()->greaterThanOrEqualTo($e->previous_return_at)) {
            $this->lapseExtensions();
            throw ValidationException::withMessages(['extension' => 'The original return time has passed, so this extension lapsed. Normal late fees apply.']);
        }
        $old = $e->payment_id ? Payment::find($e->payment_id) : null;
        if ($old && $old->status === 'pending') $old = $this->payments->verify($old);
        if ($old && $old->status === 'succeeded') return $old;
        if ($old && $old->status === 'pending' && $old->checkout_url && (! $method || $method === $old->method)) return $old;
        if ($old && $old->status === 'pending' && $old->provider_session_id) {
            app(PaymentGateway::class)->cancelSession($old->provider_session_id);
            $old->update(['status' => 'failed', 'failure_reason' => 'The renter chose another payment method.']);
        }
        try {
            $payment = $this->payments->startCheckout($b, $method ?: ($old?->method ?? $this->extensionMethod($b)), 'extension', $e);
        } catch (PaymentGatewayException) {
            throw ValidationException::withMessages(['payment' => 'We couldn\'t open the payment page just now. Nothing was charged. Please try again in a moment.']);
        }
        $e->update(['payment_id' => $payment->id]);
        return $payment;
    }

    /** Approved but unpaid by the original return time: the extension lapses, the open payment page is closed, late fees apply as usual. */
    public function lapseExtensions(): int
    {
        $n = 0;
        BookingExtension::where('status', 'awaiting_payment')->where('previous_return_at', '<=', now())->with(['booking.vehicle', 'payment'])
            ->each(function (BookingExtension $e) use (&$n) {
                if ($e->payment?->status === 'pending') $this->payments->verify($e->payment); // paid a second ago?
                $e->refresh();
                if ($e->status !== 'awaiting_payment') return;
                $b = $e->booking;
                $e->update(['status' => 'lapsed']);
                if ($e->payment?->status === 'pending') {
                    if ($e->payment->provider_session_id) app(PaymentGateway::class)->cancelSession($e->payment->provider_session_id);
                    $e->payment->update(['status' => 'failed', 'failure_reason' => 'The extension lapsed: not paid before the original return time.']);
                }
                $b->log('extension', 'The extension lapsed: it was not paid before the original return time. Normal late fees apply.');
                Notifier::send($b->renter_id, 'Extension lapsed', "You didn't pay for the extra time before the original return time, so it lapsed. Please return {$b->vehicle->name} now; normal late fees apply.", "/account/trips/{$b->reference}", 'danger');
                Notifier::send($b->host_id, 'Extension lapsed', "The renter didn't pay for the extension on {$b->reference}. The original return time stands.", "/host/bookings/{$b->reference}", 'warning');
                $n++;
            });
        return $n;
    }

    // ---------------------------------------------------------------- "car not returned"

    public function overdueHours(Booking $b): int
    {
        return $b->return_at->isFuture() ? 0 : (int) floor($b->return_at->diffInMinutes(now()) / 60);
    }

    public function canReportNotReturned(Booking $b): bool
    {
        return $b->status === 'active' && ! $b->checkout_submitted_at && $this->overdueHours($b) >= (int) Settings::get('theft_overdue_hours')
            && $b->admin_flag !== 'possible_theft' && ! $b->extensions()->where('status', 'pending')->exists();
    }

    /** The host says the car has not come back. This flags a possible theft and puts the renter on hold until an admin looks. */
    public function reportNotReturned(Booking $b, User $host): Booking
    {
        if (! $this->canReportNotReturned($b)) {
            throw ValidationException::withMessages(['booking' => 'You can report "car not returned" once the trip is '.(int) Settings::get('theft_overdue_hours').' hours overdue with no approved extension.']);
        }
        $renter = $b->renter;
        DB::transaction(function () use ($b, $host, $renter) {
            Incident::create([
                'booking_id' => $b->id, 'reporter_id' => $host->id, 'type' => 'theft', 'amount_claimed' => 0,
                'description' => "Car not returned. The trip is {$this->overdueHours($b)} hours overdue and the renter has not handed the vehicle back or submitted return photos.",
            ]);
            $this->accounts->suspend($renter, null, "Possible theft: {$b->vehicle->name} was not returned for booking {$b->reference}. Under admin review.", null, false);
            // The suspension marks the renter's trips as "renter blocked"; this one is the more serious flag.
            $b->update(['admin_flag' => 'possible_theft', 'admin_flag_note' => 'Host reported the car not returned, '.$this->overdueHours($b).' hours overdue.', 'flagged_at' => now()]);
            $b->log('incident', 'Host reported the car NOT RETURNED. Possible theft: renter put on hold pending admin review.', $host->id);
            Notifier::admins('URGENT: possible vehicle theft', "Booking {$b->reference}: {$b->vehicle->name} is {$this->overdueHours($b)} h overdue and was reported not returned. The renter was put on hold.", "/admin/bookings/{$b->reference}", 'danger');
            Notifier::send($renter, 'Your account is on hold', "Your host reported that {$b->vehicle->name} was not returned for {$b->reference}. Please return it right away and contact support.", '/help#contact', 'danger');
        });
        try {
            Mail::raw("Hi {$renter->name},\n\nYour host reported that the {$b->vehicle->name} was not returned for booking {$b->reference} (return time was ".$b->return_at->timezone('Asia/Manila')->format('M j, g:i A').").\nYour account is on hold while our team reviews this. If the car is with you, please return it right away and contact support at support@byahego.ph.\n\nByaheGo", fn ($m) => $m->to($renter->email)->subject("Action needed: {$b->reference} was not returned"));
        } catch (\Throwable $e) {
            Log::warning("Could not email the not-returned notice for {$b->reference}: ".$e->getMessage());
        }
        return $b->fresh();
    }

    // ---------------------------------------------------------------- scheduled jobs

    /** One hour before the return time: a reminder, once per return time. */
    public function sendReturnReminders(): int
    {
        $n = 0;
        Booking::where('status', 'active')->whereNull('checkout_submitted_at')->whereNull('return_reminder_sent_at')
            ->where('return_at', '>', now())->where('return_at', '<=', now()->addHour())
            ->each(function (Booking $b) use (&$n) {
                Notifier::send($b->renter_id, 'Return time is near', "Please return {$b->vehicle->name} by {$b->return_at->timezone('Asia/Manila')->format('g:i A')} and take the return photos in the app. After the grace period, late fees apply.", "/account/trips/{$b->reference}", 'warning');
                $b->update(['return_reminder_sent_at' => now()]);
                $n++;
            });
        return $n;
    }

    /** Check-ins nobody answered are accepted; returns the host did not decide on complete by themselves. */
    public function sweep(): array
    {
        $accepted = Inspection::where('stage', 'checkin')->where('host_status', 'pending')
            ->where('submitted_at', '<=', now()->subHours((int) Settings::get('checkin_host_window_hours')))
            ->update(['host_status' => 'auto_accepted', 'host_responded_at' => now()]);

        $completed = 0;
        Booking::where('status', 'active')->whereNotNull('checkout_submitted_at')->where('host_review_due_at', '<=', now())->with('host')
            ->each(function (Booking $b) use (&$completed) {
                try {
                    $this->acceptReturn($b, $b->host, true);
                    $completed++;
                } catch (\Throwable $e) {
                    Log::error("Could not auto-complete {$b->reference}: ".$e->getMessage());
                }
            });
        return ['checkins_accepted' => $accepted, 'trips_completed' => $completed, 'reminders' => $this->sendReturnReminders(), 'extensions_lapsed' => $this->lapseExtensions()];
    }

    // ---------------------------------------------------------------- what the apps show

    public function presentInspection(?Inspection $i): ?array
    {
        if (! $i) return null;
        $i->loadMissing('photos.uploader');
        return [
            'id' => $i->id, 'stage' => $i->stage, 'odometer' => $i->odometer, 'fuel_level' => $i->fuel_level, 'notes' => $i->notes,
            'submitted_at' => $i->submitted_at?->toIso8601String(), 'host_status' => $i->host_status, 'host_notes' => $i->host_notes,
            'host_responded_at' => $i->host_responded_at?->toIso8601String(),
            'host_window_ends_at' => $i->stage === 'checkin' && $i->host_status === 'pending' ? $i->submitted_at->copy()->addHours((int) Settings::get('checkin_host_window_hours'))->toIso8601String() : null,
            'photos' => $i->photos->map(fn (InspectionPhoto $p) => [
                'id' => $p->id, 'media_id' => $p->media_id, 'angle' => $p->angle, 'label' => (self::ANGLES + self::EXTRA_ANGLES)[$p->angle] ?? $p->angle,
                'live' => $p->live, 'device_time' => $p->device_time?->toIso8601String(), 'server_time' => $p->created_at?->toIso8601String(),
                'lat' => $p->lat, 'lng' => $p->lng, 'note' => $p->note, 'sha256' => $p->sha256,
                'uploader_role' => $p->uploader_id === $i->booking?->host_id ? 'host' : 'renter',
            ])->values(),
        ];
    }

    protected function presentExtension(Booking $b, BookingExtension $ext, string $viewer): array
    {
        // An approved extension nobody paid for is already lapsed once the original return time has passed, even before the sweep runs.
        $status = $ext->status === 'awaiting_payment' && $ext->previous_return_at->isPast() ? 'lapsed' : $ext->status;
        $price = $ext->status === 'pending' ? $this->pricing->extensionCharge($b->vehicle, $ext->previous_return_at, $ext->requested_return_at) : ['amount' => $ext->amount, 'hours' => $ext->hours];
        $open = $ext->payment && $ext->payment->status === 'pending' ? $ext->payment : null;
        return [
            'id' => $ext->id, 'status' => $status, 'requested_return_at' => $ext->requested_return_at->toIso8601String(),
            'previous_return_at' => $ext->previous_return_at->toIso8601String(), 'note' => $ext->note, 'responded_at' => $ext->responded_at?->toIso8601String(),
            'amount' => (int) $price['amount'], 'hours' => (int) $price['hours'], 'is_estimate' => $ext->status === 'pending',
            'pay_by' => $ext->status === 'awaiting_payment' ? $ext->previous_return_at->toIso8601String() : null,
            'checkout_url' => $viewer === 'renter' && $status === 'awaiting_payment' ? $open?->checkout_url : null,
        ];
    }

    /** The "trip" block of a booking: photo sets, what each person can do next, the excess-hours breakdown and any extension. */
    public function present(Booking $b, string $viewer): array
    {
        $checkin = $this->inspection($b, 'checkin');
        $checkout = $this->inspection($b, 'checkout');
        $ext = $b->extensions()->first();
        $late = $b->checkout_submitted_at || $b->status === 'completed'
            ? ['hours' => (int) $b->late_hours, 'fee' => (int) $b->late_fee] + $this->pricing->lateFee($b->vehicle, $b->return_at, $b->actual_return_at ?? now())
            : $this->pricing->lateFee($b->vehicle, $b->return_at, now());
        return [
            'checkin' => $this->presentInspection($checkin),
            'checkout' => $this->presentInspection($checkout),
            'can_checkin' => $this->checkinOpens($b) && ! $checkin,
            'checkin_opens_at' => $b->status === 'confirmed' ? $b->pickup_at->copy()->subHours(12)->toIso8601String() : null,
            'can_checkout' => $b->status === 'active' && (bool) $checkin && ! $checkout,
            'checkout_submitted_at' => $b->checkout_submitted_at?->toIso8601String(),
            'host_review_due_at' => $b->status === 'active' ? $b->host_review_due_at?->toIso8601String() : null,
            'late' => [
                'hours' => $late['hours'], 'fee' => $late['fee'], 'grace_minutes' => $late['grace_minutes'], 'per_hour' => $late['per_hour'],
                'extra_day_applied' => $late['extra_day_applied'], 'full_day_after_hours' => (int) Settings::get('excess_hours_full_day'),
                'is_overdue' => $b->status === 'active' && ! $b->checkout_submitted_at && $b->return_at->isPast(),
            ],
            'extension' => $ext ? $this->presentExtension($b, $ext, $viewer) : null,
            'can_request_extension' => $viewer === 'renter' && $b->status === 'active' && ! $b->checkout_submitted_at && $b->return_at->isFuture() && ! $b->extensions()->whereIn('status', ['pending', 'awaiting_payment'])->exists(),
            'overdue_hours' => $b->status === 'active' ? $this->overdueHours($b) : 0,
            'can_report_not_returned' => $viewer === 'host' && $this->canReportNotReturned($b),
            'not_returned_after_hours' => (int) Settings::get('theft_overdue_hours'),
        ];
    }
}
