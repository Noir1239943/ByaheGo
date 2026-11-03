<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Notification;
use App\Models\UserNotification;
use App\Services\BookingService;
use App\Support\Settings;
use Tests\TestCase;

class AgreementAndCancellationTest extends TestCase
{
    protected function window(int $from = 5, int $to = 7): array
    {
        return [
            'pickup_at' => now()->addDays($from)->setTime(10, 0)->toIso8601String(),
            'return_at' => now()->addDays($to)->setTime(10, 0)->toIso8601String(),
            'rental_type' => 'self',
            'protection_plan' => 'plus',
        ];
    }

    protected function preview($renter, $vehicle, ?array $window = null)
    {
        return $this->as($renter)->postJson("/api/vehicles/{$vehicle->id}/agreement", $window ?? $this->window());
    }

    public function test_agreement_is_filled_with_the_booking_values(): void
    {
        $host = $this->host();
        $v = $this->vehicle(['security_deposit' => 4500, 'late_fee_per_hour' => 275, 'grace_minutes' => 20, 'fuel_policy' => 'full_to_full', 'plate_number' => 'XYZ 987'], $host);
        $renter = $this->verifiedRenter();

        $this->guest()->postJson("/api/vehicles/{$v->id}/agreement", $this->window())->assertStatus(401);
        $r = $this->preview($renter, $v)->assertOk();
        $text = $r->json('text');
        foreach ([$renter->name, $host->name, 'Toyota Fortuner', 'XYZ 987', '₱4,500', '₱275', '20 minutes', 'full to full', 'Ayala Center Cebu Hub', 'Plus protection', 'Free cancellation', 'sub-rent'] as $needle) {
            $this->assertStringContainsStringIgnoringCase($needle, $text, "agreement should mention {$needle}");
        }
        $this->assertSame(hash('sha256', $text), $r->json('hash'));
        $this->assertSame('2026.2', $r->json('version'));
        $this->assertSame($renter->name, $r->json('signer_name'));
        $this->assertSame($text, $this->preview($renter, $v)->json('text')); // deterministic
    }

    public function test_cannot_book_without_signing_with_the_verified_name(): void
    {
        $v = $this->vehicle();
        $renter = $this->verifiedRenter();
        $payload = $this->bookingPayload($v);
        $p = $this->preview($renter, $v, array_intersect_key($payload, array_flip(['pickup_at', 'return_at', 'rental_type', 'protection_plan'])))->json();
        $good = $payload + ['signature_name' => $p['signer_name'], 'agreement_hash' => $p['hash']];

        $this->as($renter)->postJson('/api/bookings', array_diff_key($good, ['signature_name' => 1]))->assertStatus(422)->assertJsonValidationErrors('signature_name');
        $this->as($renter)->postJson('/api/bookings', array_diff_key($good, ['agreement_hash' => 1]))->assertStatus(422)->assertJsonValidationErrors('agreement_hash');
        $this->as($renter)->postJson('/api/bookings', array_diff_key($good, ['agreement_read_to_end' => 1]))->assertStatus(422)->assertJsonValidationErrors('agreement_read_to_end');
        $this->as($renter)->postJson('/api/bookings', array_diff_key($good, ['agree_terms' => 1]))->assertStatus(422)->assertJsonValidationErrors('agree_terms');
        $wrong = $this->as($renter)->postJson('/api/bookings', ['signature_name' => 'Somebody Else'] + $good)->assertStatus(422)->assertJsonValidationErrors('signature_name');
        $this->assertStringContainsString($p['signer_name'], $wrong->json('errors.signature_name.0'));
        $this->as($renter)->postJson('/api/bookings', ['agreement_hash' => str_repeat('a', 64)] + $good)->assertStatus(422)->assertJsonValidationErrors('agreement');
        $this->assertSame(0, Booking::count());
        $this->assertSame(0, $v->bookings()->count());
    }

    public function test_signed_snapshot_is_stored_and_never_changes(): void
    {
        $v = $this->vehicle();
        $renter = $this->verifiedRenter(['name' => 'Maria Santos-Reyes']);
        $preview = $this->preview($renter, $v)->assertOk();

        $res = $this->withHeader('User-Agent', 'TestBrowser/1.0')->as($renter)->postJson('/api/bookings', $this->bookingPayload($v, $this->window()) + [
            'signature_name' => 'santos reyes,  MARIA', 'agreement_hash' => $preview->json('hash'),
        ]);
        $res->assertCreated()->assertJsonPath('agreement.has_copy', true)->assertJsonPath('agreement.signer_name', 'santos reyes,  MARIA')->assertJsonPath('agreement.version', '2026.2');
        $b = Booking::where('reference', $res->json('reference'))->first();
        $a = $b->agreement;
        $this->assertSame($preview->json('text'), $a->text);
        $this->assertSame($preview->json('hash'), $a->hash);
        $this->assertSame(hash('sha256', $a->text), $a->hash);
        $this->assertSame('TestBrowser/1.0', $a->user_agent);
        $this->assertNotNull($a->ip);
        $this->assertTrue($a->read_to_end);
        $this->assertEqualsWithDelta(now()->timestamp, $a->signed_at->timestamp, 5);

        // The host later raising the price or changing the policy does not touch what was signed.
        $v->update(['late_fee_per_hour' => 999, 'security_deposit' => 9999]);
        $this->assertSame($preview->json('text'), $b->agreement()->first()->text);
    }

    public function test_pdf_is_available_to_renter_host_and_admin_only(): void
    {
        $host = $this->host();
        $v = $this->vehicle([], $host);
        $renter = $this->verifiedRenter();
        $ref = $this->book($renter, $v)->assertCreated()->json('reference');

        foreach ([[$renter, "/api/bookings/{$ref}/agreement.pdf"], [$host, "/api/host/bookings/{$ref}/agreement.pdf"], [$this->admin(), "/api/admin/bookings/{$ref}/agreement.pdf"]] as [$who, $url]) {
            $r = $this->as($who)->get($url)->assertOk()->assertHeader('Content-Type', 'application/pdf');
            $this->assertStringStartsWith('%PDF', $r->getContent());
            $this->assertGreaterThan(3000, strlen($r->getContent()));
        }
        $this->as($this->verifiedRenter())->get("/api/bookings/{$ref}/agreement.pdf")->assertNotFound();
        $this->as($this->host())->get("/api/host/bookings/{$ref}/agreement.pdf")->assertNotFound();
        $this->guest()->withHeader('Accept', 'application/json')->get("/api/bookings/{$ref}/agreement.pdf")->assertStatus(401);
    }

    public function test_confirmation_email_with_the_pdf_goes_to_renter_and_host(): void
    {
        $host = $this->host();
        $v = $this->vehicle([], $host);
        $renter = $this->verifiedRenter();
        $this->book($renter, $v)->assertCreated();

        $messages = app('mailer')->getSymfonyTransport()->messages();
        $this->assertCount(2, $messages);
        $to = $messages->map(fn ($m) => $m->getOriginalMessage()->getTo()[0]->getAddress())->all();
        $this->assertEqualsCanonicalizing([$renter->email, $host->email], $to);
        $atts = $messages->first()->getOriginalMessage()->getAttachments();
        $this->assertCount(1, $atts);
        $this->assertSame('pdf', $atts[0]->getMediaSubtype());
        $this->assertStringContainsString('Booking confirmed', $messages->first()->getOriginalMessage()->getSubject());
    }

    public function test_a_broken_mail_server_does_not_undo_the_booking(): void
    {
        config(['mail.default' => 'smtp', 'mail.mailers.smtp.host' => '127.0.0.1', 'mail.mailers.smtp.port' => 1, 'mail.mailers.smtp.timeout' => 1]);
        app()->forgetInstance('mail.manager');
        app()->forgetInstance('mailer');
        $this->book($this->verifiedRenter(), $this->vehicle())->assertCreated();
        $this->assertSame(1, Booking::count());
    }

    public function test_renter_cancellation_is_free_by_default_and_blocked_inside_the_window(): void
    {
        $v = $this->vehicle();
        $renter = $this->verifiedRenter();
        $ref = $this->book($renter, $v)->assertCreated()->assertJsonPath('can_cancel', true)->json('reference');
        $this->as($renter)->postJson("/api/bookings/{$ref}/cancel", ['reason' => 'Plans changed'])->assertOk()
            ->assertJsonPath('status', 'cancelled')->assertJsonPath('payment_status', 'refunded')->assertJsonPath('cancellation_fee', 0);

        $near = $this->vehicle();
        $r2 = $this->verifiedRenter();
        $ref2 = $this->book($r2, $near, ['pickup_at' => now()->addHours(10)->toIso8601String(), 'return_at' => now()->addDays(2)->toIso8601String()])->assertCreated()
            ->assertJsonPath('can_cancel', false)->json('reference');
        $this->as($r2)->postJson("/api/bookings/{$ref2}/cancel")->assertStatus(422)->assertJsonValidationErrors('booking');
    }

    public function test_configurable_cancellation_fee_is_kept_and_only_applies_to_renters(): void
    {
        Settings::set(['cancellation_fee' => 250]);
        $v = $this->vehicle();
        $renter = $this->verifiedRenter();
        $b = $this->book($renter, $v)->assertCreated();
        $paid = $b->json('total') + $b->json('security_deposit');
        $ref = $b->json('reference');
        $res = $this->as($renter)->postJson("/api/bookings/{$ref}/cancel")->assertOk()->assertJsonPath('cancellation_fee', 250)->assertJsonPath('payment_status', 'partially_refunded');
        $booking = Booking::where('reference', $ref)->first();
        $this->assertSame($paid - 250, (int) $booking->payments()->where('type', 'refund')->sum('amount'));
        $this->assertSame(250, (int) $booking->payments()->where('type', 'cancellation_fee')->sum('amount'));

        // Admin override: inside the window, with no fee.
        $r2 = $this->verifiedRenter();
        $near = $this->book($r2, $this->vehicle(), ['pickup_at' => now()->addHours(5)->toIso8601String(), 'return_at' => now()->addDays(2)->toIso8601String()])->assertCreated();
        $this->as($this->admin())->postJson("/api/admin/bookings/{$near->json('reference')}/cancel", ['reason' => 'Renter emergency', 'refund' => true])->assertOk()
            ->assertJsonPath('status', 'cancelled')->assertJsonPath('cancellation_fee', 0);
    }

    public function test_host_can_cancel_any_time_with_a_full_refund_and_it_is_counted(): void
    {
        Settings::set(['cancellation_fee' => 500]);
        $host = $this->host();
        $admin = $this->admin();
        $v = $this->vehicle([], $host);
        $renter = $this->verifiedRenter();
        $b = $this->book($renter, $v, ['pickup_at' => now()->addHours(6)->toIso8601String(), 'return_at' => now()->addDays(2)->toIso8601String()])->assertCreated();
        $ref = $b->json('reference');
        $paid = $b->json('total') + $b->json('security_deposit');

        $this->as($host)->postJson("/api/host/bookings/{$ref}/cancel", [])->assertStatus(422)->assertJsonValidationErrors('reason');
        $this->as($this->host())->postJson("/api/host/bookings/{$ref}/cancel", ['reason' => 'Not mine to cancel'])->assertNotFound();
        $this->as($host)->postJson("/api/host/bookings/{$ref}/cancel", ['reason' => 'Car broke down'])->assertOk()
            ->assertJsonPath('status', 'cancelled')->assertJsonPath('cancelled_by', 'host')->assertJsonPath('cancellation_fee', 0);

        $booking = Booking::where('reference', $ref)->first();
        $this->assertSame($paid, (int) $booking->payments()->where('type', 'refund')->sum('amount')); // everything, the fee does not apply
        $this->assertSame(1, (int) $host->fresh()->host_cancellations);
        $this->assertTrue(UserNotification::where('user_id', $admin->id)->where('title', 'Host cancelled a booking')->exists());
        $this->as($admin)->getJson("/api/admin/users/{$host->id}")->assertOk()->assertJsonPath('user.host_cancellations', 1);
    }

    public function test_unpaid_pending_bookings_hold_the_dates_until_they_expire(): void
    {
        $v = $this->vehicle();
        $renter = $this->verifiedRenter();
        $ref = $this->book($renter, $v)->assertCreated()->json('reference');
        $b = Booking::where('reference', $ref)->first();
        $from = $b->pickup_at->copy();
        $to = $b->return_at->copy();

        $b->update(['status' => 'pending', 'payment_status' => 'unpaid', 'expires_at' => now()->addMinutes(20)]);
        $this->assertFalse($v->fresh()->isFreeBetween($from, $to)); // the hold blocks the dates
        $this->assertSame(0, app(BookingService::class)->expirePending());

        $b->update(['expires_at' => now()->subMinute()]);
        $this->assertTrue($v->fresh()->isFreeBetween($from, $to));  // lapsed holds no longer block, even before the sweep runs
        $this->artisan('bookings:expire-pending')->expectsOutputToContain('Expired 1')->assertSuccessful();
        $this->assertSame('cancelled', $b->fresh()->status);
        $this->assertSame('system', $b->fresh()->cancelled_by);
        $this->assertTrue(UserNotification::where('user_id', $renter->id)->where('title', 'Booking expired')->exists());
    }

    public function test_listing_grace_period_decides_when_late_fees_start(): void
    {
        $host = $this->host();
        $strict = $this->vehicle(['grace_minutes' => 10, 'late_fee_per_hour' => 300], $host);
        $easy = $this->vehicle(['grace_minutes' => 90, 'late_fee_per_hour' => 300], $host);
        $pricing = app(\App\Services\PricingService::class);
        $scheduled = now()->addDays(3);
        $this->assertSame(300, $pricing->lateFee($strict, $scheduled, $scheduled->copy()->addMinutes(30))['fee']);
        $this->assertSame(0, $pricing->lateFee($easy, $scheduled, $scheduled->copy()->addMinutes(30))['fee']);
        $this->assertSame(0, $pricing->lateFee($strict, $scheduled, $scheduled->copy()->addMinutes(10))['hours']);
    }

    public function test_default_deposit_and_unsettled_deposits_are_handled(): void
    {
        Settings::set(['default_security_deposit' => 4200]);
        $host = $this->host();
        $res = $this->as($host)->postJson('/api/host/vehicles', ['make' => 'Toyota', 'model' => 'Vios', 'year' => 2022, 'type' => 'sedan', 'transmission' => 'automatic', 'fuel' => 'gasoline', 'seats' => 5])->assertCreated();
        $this->assertSame(4200, $res->json('security_deposit'));
        $own = $this->as($host)->postJson('/api/host/vehicles', ['make' => 'Honda', 'model' => 'City', 'year' => 2022, 'type' => 'sedan', 'transmission' => 'automatic', 'fuel' => 'gasoline', 'seats' => 5, 'security_deposit' => 2500])->assertCreated();
        $this->assertSame(2500, $own->json('security_deposit'));

        // A completed trip whose deposit never got settled is settled after the release window.
        $renter = $this->verifiedRenter();
        $ref = $this->book($renter, $this->vehicle())->assertCreated()->json('reference');
        $b = Booking::where('reference', $ref)->first();
        $b->update(['status' => 'completed', 'actual_return_at' => now()->subDays(5), 'deposit_status' => 'held']);
        $this->artisan('deposits:release-due')->expectsOutputToContain('Settled 1')->assertSuccessful();
        $this->assertSame('released', $b->fresh()->deposit_status);
        $this->assertNotNull($b->fresh()->settled_at);
        $this->artisan('deposits:release-due')->expectsOutputToContain('Settled 0');
    }
}
