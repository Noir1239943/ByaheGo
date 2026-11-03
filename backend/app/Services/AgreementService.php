<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\BookingAgreement;
use App\Models\User;
use App\Models\Vehicle;
use App\Support\Money;
use App\Support\Protection;
use App\Support\Settings;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\CarbonInterface;
use Illuminate\Support\Str;

/**
 * The rental agreement. A versioned template is filled with the values of one booking, shown to the renter before they
 * pay, and the exact text they sign is stored (with a hash) so it can never change afterwards.
 */
class AgreementService
{
    /** Bump this whenever the wording below changes. Old bookings keep the version (and text) they signed. */
    public const VERSION = '2026.2';

    public const TZ = 'Asia/Manila';

    public function when(CarbonInterface $t): string
    {
        return $t->copy()->timezone(self::TZ)->format('D, M j, Y \a\t g:i A');
    }

    /** The name the renter must type: the one on their verified license for self-drive, otherwise their account name. */
    public function verifiedName(User $renter, string $rentalType): string
    {
        $license = $rentalType === 'self' ? $renter->latestLicense : null;
        return trim($license?->full_name ?: $renter->name);
    }

    /** Same words in any order, ignoring case, accents, punctuation and extra spaces. */
    public function namesMatch(string $typed, string $verified): bool
    {
        $tokens = function (string $s): array {
            $words = preg_split('/\s+/', trim(preg_replace('/[^a-z ]+/', ' ', strtolower(Str::ascii($s))))) ?: [];
            $words = array_values(array_filter($words));
            sort($words);
            return $words;
        };
        $a = $tokens($typed);
        return $a !== [] && $a === $tokens($verified);
    }

    /**
     * @param array $quote the result of PricingService::quote()
     * @return array{version: string, title: string, sections: array<int, array{title: string, body: array<int, string>}>, text: string, hash: string, signer_name: string}
     */
    public function build(Vehicle $v, User $renter, array $quote, CarbonInterface $pickup, CarbonInterface $return, string $rentalType): array
    {
        $v->loadMissing(['host', 'hub']);
        $peso = fn ($n) => Money::peso($n);
        $name = $this->verifiedName($renter, $rentalType);
        $plan = Protection::get($quote['protection_plan']);
        $cutoff = (int) Settings::get('cancellation_cutoff_hours');
        $freeUntil = $pickup->copy()->subHours($cutoff);
        $fee = (int) Settings::get('cancellation_fee');
        $grace = (int) ($v->grace_minutes ?? Settings::get('late_grace_minutes'));
        $dailyCap = Settings::get('late_fee_daily_cap');
        $releaseDays = (int) Settings::get('deposit_release_days');
        $plate = $v->plate_number ?: 'to be shown after booking';
        $rentalLabel = $rentalType === 'driver' ? 'With a driver provided by the host' : 'Self-drive';

        $lines = [
            "Rental ({$quote['days']} day".($quote['days'] === 1 ? '' : 's')." at {$peso($quote['daily_rate'])}/day): {$peso($quote['rental_subtotal'] + $quote['weekly_discount'])}",
        ];
        if ($quote['weekly_discount'] > 0) $lines[] = "Weekly rate discount: -{$peso($quote['weekly_discount'])}";
        if ($quote['driver_fee_total'] > 0) $lines[] = "Driver fee: {$peso($quote['driver_fee_total'])}";
        $lines[] = "{$plan['name']}: {$peso($quote['protection_total'])}";
        $lines[] = "Service fee ({$quote['service_fee_rate']}%): {$peso($quote['service_fee'])}";
        $lines[] = "Trip total: {$peso($quote['total'])}";
        $lines[] = "Refundable security deposit (collected as its own line): {$peso($quote['security_deposit'])}";
        $lines[] = "Total charged now: {$peso($quote['due_now'])}";

        $fuel = $v->fuel_policy === 'full_to_full'
            ? 'Fuel policy: full to full. The car is handed over with a full tank and must be returned with a full tank.'
            : 'Fuel policy: same level. Return the car with the same fuel level it had at pick-up.';

        $sections = [
            ['title' => '1. The parties and the vehicle', 'body' => [
                "Renter (verified name): {$name}.",
                "Host: {$v->host->name}.",
                "Vehicle: {$v->name}, plate number {$plate}.",
                'ByaheGo is the platform that connects the renter and the host and handles payment. The renter rents the vehicle from the host under this agreement.',
            ]],
            ['title' => '2. The trip', 'body' => [
                "Pick-up: {$this->when($pickup)}.",
                "Return: {$this->when($return)}.",
                "Pick-up location: {$v->pickupLabel()}. ".($v->isOwnPickup() ? 'The exact meeting spot is shown in your confirmed booking.' : 'This is a ByaheGo hub.'),
                "Type of rental: {$rentalLabel}.",
            ]],
            ['title' => '3. Price and payment', 'body' => array_merge($lines, [
                'All amounts are in Philippine pesos. You receive an official receipt for every payment in Payments & billing.',
            ])],
            ['title' => '4. Security deposit', 'body' => [
                "A refundable security deposit of {$peso($quote['security_deposit'])} is collected together with your payment and held during the trip.",
                "After the return check, late fees and approved damage are taken from the deposit first. What is left is released to your original payment method within {$releaseDays} days. If charges are higher than the deposit, the remaining balance is billed to you.",
                'The deposit is released in full when the host marks the return as "All good".',
            ]],
            ['title' => '5. Fuel, return time and late returns', 'body' => [
                $fuel,
                "Grace period: {$grace} minutes after the scheduled return time, free of charge.",
                "After the grace period, an excess-hour fee of {$peso($v->late_fee_per_hour)} per hour (or part of an hour) applies, capped at {$dailyCap}x the daily rate for each day late. It is taken from the deposit first.",
                'Missing fuel is charged at pump price plus a ₱200 refuelling fee. If you need more time, ask the host before the return time.',
            ]],
            ['title' => '6. Cancellation', 'body' => [
                "Free cancellation until {$this->when($freeUntil)} ({$cutoff} hours before pick-up). If you cancel by then, you get back the rental and the deposit".($fee > 0 ? ", minus a cancellation fee of {$peso($fee)}." : ' in full.'),
                "Within {$cutoff} hours of pick-up, trips can no longer be cancelled in the app. You can still message the host, contact support or open a dispute.",
                'If the host or ByaheGo cancels, you always get a full refund.',
            ]],
            ['title' => '7. Damage and liability', 'body' => [
                "If the vehicle is damaged during your trip, you pay the assessed repair cost, up to the limit of your protection plan ({$plan['name']}: {$peso($plan['liability_cap'])}). The deposit is applied first, and any remainder is billed to you.",
                'The host reports damage with photos and an estimate. ByaheGo reviews every claim and can approve, reduce or dismiss it. You are never charged for damage that is already recorded in the pick-up inspection.',
            ]],
            ['title' => '8. Loss, theft and missing parts', 'body' => [
                'Protection plans do not cover theft, loss, missing parts or tampering. If the vehicle is stolen or lost while in your care, or parts are removed or swapped, you pay the replacement cost.',
                'Report theft to the police right away, send ByaheGo the police report, and tell us at once. If the vehicle is not returned, your account is suspended, the deposit is forfeited and the case may be reported to the police.',
            ]],
            ['title' => '9. Traffic violations, fines and tolls', 'body' => [
                'You are responsible for traffic tickets, towing, parking fees, tolls and fines during the trip. Fines that reach the host afterwards are billed to you with proof.',
            ]],
            ['title' => '10. Use of the vehicle', 'body' => [
                'Only the renter named above (or the driver provided by the host) may drive. Drivers must be at least 21 and hold a valid license.',
                'You may not sub-rent, lend or resell the vehicle, use it for anything illegal, drive under the influence, race, or carry goods or passengers for hire. Keep the vehicle on Cebu island unless the host allows otherwise in writing. No smoking.',
            ]],
            ['title' => '11. Accidents and incidents', 'body' => [
                'After any accident, breakdown or incident: make sure everyone is safe, call the police if needed, take photos, tell the host and ByaheGo immediately through the app, and do not admit fault or agree to pay anyone on the spot.',
            ]],
            ['title' => '12. Electronic signature', 'body' => [
                'By typing my full name and ticking "I agree", I confirm that I have read this whole agreement and accept it. I understand that this counts as my signature and that ByaheGo keeps a copy of the exact text, with the date, time and device I signed from.',
            ]],
        ];

        $title = 'ByaheGo Rental Agreement';
        $text = $title."\nVersion ".self::VERSION."\n";
        foreach ($sections as $s) {
            $text .= "\n".$s['title']."\n".implode("\n", $s['body'])."\n";
        }

        return [
            'version' => self::VERSION,
            'title' => $title,
            'sections' => $sections,
            'text' => $text,
            'hash' => hash('sha256', $text),
            'signer_name' => $name,
        ];
    }

    public function sign(Booking $booking, array $built, string $typedName, ?string $ip, ?string $userAgent, bool $readToEnd): BookingAgreement
    {
        return BookingAgreement::create([
            'booking_id' => $booking->id,
            'version' => $built['version'],
            'text' => $built['text'],
            'hash' => $built['hash'],
            'signer_name' => $typedName,
            'signed_at' => now(),
            'ip' => $ip,
            'user_agent' => $userAgent ? Str::limit($userAgent, 500, '') : null,
            'read_to_end' => $readToEnd,
        ]);
    }

    /** Rebuilds the price block from what a booking stored. Used for demo data and for bookings made before e-signing existed. */
    public function quoteFromBooking(Booking $b): array
    {
        $plan = Protection::get($b->protection_plan ?? 'standard');
        $discount = max(0, $b->daily_rate * $b->days - $b->rental_subtotal);
        return [
            'days' => $b->days, 'daily_rate' => $b->daily_rate, 'rental_subtotal' => $b->rental_subtotal, 'weekly_discount' => $discount,
            'driver_fee_total' => $b->driver_fee_total, 'protection_plan' => $plan['key'], 'protection_name' => $plan['name'], 'protection_total' => $b->protection_total,
            'liability_cap' => $plan['liability_cap'], 'service_fee' => $b->service_fee, 'service_fee_rate' => Settings::get('service_fee_rate'), 'total' => $b->total,
            'security_deposit' => $b->security_deposit, 'due_now' => $b->total + $b->security_deposit,
        ];
    }

    /** Stores a signed copy for a booking that has none (demo data). Uses the booking's own date, name and IP. */
    public function backfill(Booking $b): ?BookingAgreement
    {
        if ($b->agreement()->exists()) return null;
        $b->loadMissing(['vehicle.host', 'vehicle.hub', 'renter.latestLicense']);
        $built = $this->build($b->vehicle, $b->renter, $this->quoteFromBooking($b), $b->pickup_at, $b->return_at, $b->rental_type);
        $a = $this->sign($b, $built, $built['signer_name'], $b->agreement_ip, 'Seeded demo data', true);
        $a->forceFill(['signed_at' => $b->agreement_accepted_at ?? $b->created_at])->save();
        $b->update(['agreement_version' => $built['version']]);
        return $a;
    }

    /** Splits a stored plain-text agreement back into titled blocks for the PDF. */
    public function sectionsFromText(string $text): array
    {
        $blocks = preg_split("/\n\s*\n/", trim($text)) ?: [];
        $head = array_shift($blocks);
        $sections = [];
        foreach ($blocks as $block) {
            $lines = array_values(array_filter(array_map('trim', explode("\n", $block)), fn ($l) => $l !== ''));
            $sections[] = ['title' => array_shift($lines), 'body' => $lines];
        }
        return [$head, $sections];
    }

    public function download(Booking $booking)
    {
        return response($this->pdf($booking), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="ByaheGo-agreement-'.$booking->reference.'.pdf"',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    public function pdf(Booking $booking): string
    {
        $booking->loadMissing(['agreement', 'vehicle', 'renter', 'host']);
        $agreement = $booking->agreement;
        abort_if(! $agreement, 404, 'There is no signed copy of the agreement for this booking.');
        [, $sections] = $this->sectionsFromText($agreement->text);

        return Pdf::loadView('pdf.agreement', [
            'booking' => $booking,
            'agreement' => $agreement,
            'sections' => $sections,
            'signedAt' => $this->when($agreement->signed_at),
        ])->setPaper('a4')->setOption(['enable_font_subsetting' => true])->output();
    }
}
