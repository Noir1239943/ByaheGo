<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Payment;
use App\Models\Payout;
use Tests\TestCase;

class BookingFlowTest extends TestCase
{
    public function test_unverified_renter_cannot_book_self_drive_but_can_book_with_driver(): void
    {
        $v = $this->vehicle();
        $u = $this->makeUser();
        $this->book($u, $v)->assertStatus(422)->assertJsonValidationErrors('verification');
        $this->book($u, $v, ['rental_type' => 'driver', 'confirm_age' => false])->assertCreated()->assertJsonPath('driver_fee_total', 3000);
    }

    public function test_verified_renter_books_and_pays(): void
    {
        $v = $this->vehicle();
        $u = $this->verifiedRenter();
        $res = $this->book($u, $v)->assertCreated()
            ->assertJsonPath('status', 'confirmed')
            ->assertJsonPath('display_status', 'upcoming')
            ->assertJsonPath('total', 6880)
            ->assertJsonPath('amount_paid', 11880)
            ->assertJsonPath('deposit_status', 'held')
            ->assertJsonPath('can_cancel', true);
        $this->assertMatchesRegularExpression('/^BG-\d+$/', $res->json('reference'));
        $this->assertSame('0917 ••• 4567', $res->json('payments.0.account_hint'));
        $this->assertStringStartsWith('OR-', $res->json('payments.0.receipt_no'));
        $this->assertNotNull($res->json('agreement.accepted_at'));
    }

    public function test_must_accept_agreement_and_dates_cannot_overlap(): void
    {
        $v = $this->vehicle();
        $a = $this->verifiedRenter();
        $b = $this->verifiedRenter();
        $this->book($a, $v, ['agree_terms' => false])->assertStatus(422)->assertJsonValidationErrors('agree_terms');
        $this->book($a, $v)->assertCreated();
        $this->book($b, $v, [
            'pickup_at' => now()->addDays(6)->setTime(9, 0)->toIso8601String(),
            'return_at' => now()->addDays(8)->setTime(9, 0)->toIso8601String(),
        ])->assertStatus(422)->assertJsonValidationErrors('pickup_at');
    }

    public function test_cannot_book_own_vehicle_and_declined_card(): void
    {
        $host = $this->host();
        $host->update(['verification_status' => 'verified']);
        $v = $this->vehicle([], $host);
        $this->book($host, $v)->assertStatus(422)->assertJsonValidationErrors('vehicle');
        $u = $this->verifiedRenter();
        $this->book($u, $v, ['payment_method' => 'card', 'card_number' => '4000 0000 0000 0002', 'card_expiry' => '12/30', 'card_cvc' => '123'])
            ->assertStatus(422)->assertJsonValidationErrors('card_number');
        $this->assertDatabaseCount('bookings', 0);
        $this->book($u, $v, ['payment_method' => 'card', 'card_number' => '4242 4242 4242 4242', 'card_expiry' => '12/30', 'card_cvc' => '123'])
            ->assertCreated()->assertJsonPath('payments.0.account_hint', '•••• 4242');
    }

    public function test_cancel_a_day_before_gets_full_refund(): void
    {
        $v = $this->vehicle();
        $u = $this->verifiedRenter();
        $ref = $this->book($u, $v)->json('reference');
        $res = $this->as($u)->postJson("/api/bookings/{$ref}/cancel", ['reason' => 'Plans changed'])->assertOk()
            ->assertJsonPath('status', 'cancelled')->assertJsonPath('payment_status', 'refunded');
        $this->assertSame(11880, (int) Payment::where('type', 'refund')->sum('amount'));
        // Billing history shows the charge and the refund.
        $this->as($u)->getJson('/api/me/billing')->assertOk()->assertJsonPath('summary.total_refunded', 11880)->assertJsonCount(2, 'data');
    }

    public function test_cannot_cancel_within_24_hours_of_pickup(): void
    {
        $v = $this->vehicle();
        $u = $this->verifiedRenter();
        $ref = $this->book($u, $v, [
            'pickup_at' => now()->addHours(20)->toIso8601String(),
            'return_at' => now()->addHours(44)->toIso8601String(),
        ])->assertCreated()->assertJsonPath('can_cancel', false)->json('reference');
        $this->as($u)->postJson("/api/bookings/{$ref}/cancel")->assertStatus(422)->assertJsonValidationErrors('booking');
        // Admin can still cancel and refund.
        $this->as($this->admin())->postJson("/api/admin/bookings/{$ref}/cancel", ['reason' => 'Vehicle breakdown', 'refund' => true])->assertOk()->assertJsonPath('status', 'cancelled');
    }

    public function test_full_trip_with_late_return_settles_deposit(): void
    {
        $host = $this->host();
        $v = $this->vehicle([], $host);
        $u = $this->verifiedRenter();
        $ref = $this->book($u, $v)->json('reference');
        $b = Booking::where('reference', $ref)->first();
        // The trip started two days ago and was due back 3 hours ago.
        $b->update(['pickup_at' => now()->subDays(2)->subHours(3), 'return_at' => now()->subHours(3)]);

        $check = ['exterior' => true, 'interior' => true, 'tires' => true, 'engine_bay' => true];
        $this->as($host)->postJson("/api/host/bookings/{$ref}/pickup", ['odometer' => 12000, 'fuel_level' => 100, 'checklist' => $check])
            ->assertOk()->assertJsonPath('status', 'active');
        // Returned now: 3 hours late (grace period is 60 minutes).
        $actual = now()->toIso8601String();
        $this->as($host)->postJson("/api/host/bookings/{$ref}/return", ['odometer' => 1, 'fuel_level' => 90, 'checklist' => $check, 'actual_return_at' => now()->addDay()->toIso8601String()])
            ->assertStatus(422)->assertJsonValidationErrors('actual_return_at');
        $res = $this->as($host)->postJson("/api/host/bookings/{$ref}/return", ['odometer' => 12450, 'fuel_level' => 90, 'checklist' => $check, 'actual_return_at' => $actual])
            ->assertOk()->assertJsonPath('status', 'completed')->assertJsonPath('late_hours', 3)->assertJsonPath('late_fee', 960)
            ->assertJsonPath('deposit_refunded', 4040)->assertJsonPath('deposit_status', 'partially_released');
        $this->assertSame(960, (int) Payment::where('type', 'late_fee')->sum('amount'));
        $payout = Payout::first();
        $this->assertSame(6400 - 960 + 960, $payout->amount); // rental − 15% commission + late fee
        $this->assertSame('scheduled', $payout->status);

        // Renter can now leave a review that updates the rating.
        $this->as($u)->postJson("/api/bookings/{$ref}/review", ['rating' => 5, 'comment' => 'Great car!'])->assertOk()->assertJsonPath('can_review', false);
        $this->assertEquals(5.0, $v->fresh()->rating_avg);
        $this->as($u)->postJson("/api/bookings/{$ref}/review", ['rating' => 4])->assertStatus(422);
    }

    public function test_damage_claim_holds_deposit_until_admin_decides(): void
    {
        $host = $this->host();
        $v = $this->vehicle([], $host);
        $u = $this->verifiedRenter();
        $ref = $this->book($u, $v)->json('reference');
        Booking::where('reference', $ref)->update(['pickup_at' => now()->subHour(), 'return_at' => now()->addDay()]);
        $check = ['exterior' => true];
        $this->as($host)->postJson("/api/host/bookings/{$ref}/pickup", ['odometer' => 100, 'fuel_level' => 100, 'checklist' => $check])->assertOk();
        $this->as($host)->postJson("/api/host/bookings/{$ref}/return", [
            'odometer' => 300, 'fuel_level' => 100, 'checklist' => ['exterior' => false], 'damage_reported' => true,
            'damage_type' => 'missing_parts', 'damage_description' => 'Battery replaced with an old one', 'damage_amount' => 7000,
        ])->assertOk()->assertJsonPath('deposit_status', 'on_hold')->assertJsonPath('display_status', 'under_review');

        $admin = $this->admin();
        $incident = $this->as($admin)->getJson('/api/admin/disputes')->assertOk()->json('data.0');
        $this->assertSame('missing_parts', $incident['type']);
        $this->as($admin)->postJson("/api/admin/disputes/{$incident['id']}/resolve", ['action' => 'charge', 'amount' => 7000, 'notes' => 'Confirmed with photos'])
            ->assertOk()->assertJsonPath('status', 'resolved');
        $b = Booking::where('reference', $ref)->first();
        $this->assertSame('applied', $b->deposit_status);
        $this->assertSame(2000, $b->balance_due); // 7,000 − 5,000 deposit
        $this->assertSame('balance_due', $b->payment_status);

        $this->as($u)->postJson("/api/bookings/{$ref}/pay-balance", ['payment_method' => 'maya', 'wallet_number' => '09181112222'])
            ->assertOk()->assertJsonPath('balance_due', 0)->assertJsonPath('payment_status', 'paid');
    }

    public function test_theft_report_lets_admin_suspend_renter(): void
    {
        $host = $this->host();
        $v = $this->vehicle([], $host);
        $u = $this->verifiedRenter();
        $ref = $this->book($u, $v)->json('reference');
        Booking::where('reference', $ref)->update(['pickup_at' => now()->subHour(), 'return_at' => now()->addDay()]);
        $this->as($host)->postJson("/api/host/bookings/{$ref}/pickup", ['odometer' => 100, 'fuel_level' => 100, 'checklist' => ['exterior' => true]])->assertOk();
        $this->as($host)->postJson("/api/host/bookings/{$ref}/incidents", ['type' => 'theft', 'description' => 'Renter not answering, car not returned.', 'amount_claimed' => 500000])->assertCreated();
        $id = $this->as($this->admin())->getJson('/api/admin/disputes')->json('data.0.id');
        $this->postJson("/api/admin/disputes/{$id}/resolve", ['action' => 'charge', 'amount' => 0, 'notes' => 'Referred to PNP', 'suspend_renter' => true])->assertOk();
        $this->assertSame('suspended', $u->fresh()->status);
    }

    public function test_admin_partial_refund_and_access_rules(): void
    {
        $v = $this->vehicle();
        $u = $this->verifiedRenter();
        $ref = $this->book($u, $v)->json('reference');
        $this->as($u)->getJson('/api/admin/bookings')->assertStatus(403);
        $other = $this->verifiedRenter();
        $this->as($other)->getJson("/api/bookings/{$ref}")->assertStatus(404);
        $admin = $this->admin();
        $this->as($admin)->postJson("/api/admin/bookings/{$ref}/refund", ['amount' => 999999, 'reason' => 'x'])->assertStatus(422);
        $this->as($admin)->postJson("/api/admin/bookings/{$ref}/refund", ['amount' => 500, 'reason' => 'Late handover goodwill'])->assertOk()
            ->assertJsonPath('payment_status', 'partially_refunded');
        $this->as($admin)->getJson("/api/admin/bookings/{$ref}")->assertOk()->assertJsonStructure(['events', 'refundable', 'commission']);
    }
}
