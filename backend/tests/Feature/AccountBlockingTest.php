<?php

namespace Tests\Feature;

use App\Models\AdminAuditLog;
use App\Models\Booking;
use App\Models\User;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class AccountBlockingTest extends TestCase
{
    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = $this->admin();
    }

    public function test_suspension_needs_a_reason_and_an_end_date_and_signs_the_user_out(): void
    {
        $u = $this->makeUser();
        $token = $u->createToken('t')->plainTextToken;
        $this->as($this->admin)->postJson("/api/admin/users/{$u->id}/suspend", ['reason' => 'Fake documents'])->assertStatus(422)->assertJsonValidationErrors('until');
        $this->as($this->admin)->postJson("/api/admin/users/{$u->id}/suspend", ['until' => now()->addDays(3)->toDateString()])->assertStatus(422)->assertJsonValidationErrors('reason');
        $this->as($this->admin)->postJson("/api/admin/users/{$u->id}/suspend", ['reason' => 'Too long', 'until' => now()->addYears(2)->toDateString()])->assertStatus(422)->assertJsonValidationErrors('until');

        $until = now()->addDays(3)->toDateString();
        $this->as($this->admin)->postJson("/api/admin/users/{$u->id}/suspend", ['reason' => 'Fake documents', 'until' => $until])->assertOk()->assertJsonPath('user.status', 'suspended');
        $this->assertSame(0, $u->tokens()->count()); // signed out everywhere
        $this->guest()->withHeader('Authorization', 'Bearer '.$token)->getJson('/api/me')->assertStatus(401);

        // At login they see why, until when, and how to appeal.
        $res = $this->guest()->postJson('/api/auth/login', ['login' => $u->username, 'password' => 'Password123'])->assertStatus(403)
            ->assertJsonPath('code', 'account_blocked')->assertJsonPath('block.type', 'suspended')->assertJsonPath('block.reason', 'Fake documents')
            ->assertJsonPath('block.appeal_email', 'support@byahego.ph');
        $this->assertStringContainsString('Fake documents', $res->json('message'));
        $this->assertStringContainsString('To appeal, email support@byahego.ph', $res->json('message'));
        $this->assertNotNull($res->json('block.until'));
    }

    public function test_suspension_ends_by_itself(): void
    {
        $u = $this->makeUser();
        $this->as($this->admin)->postJson("/api/admin/users/{$u->id}/suspend", ['reason' => 'Review', 'until' => now()->addDays(2)->toDateString()])->assertOk();

        Carbon::setTestNow(now()->addDays(3));
        $this->guest()->postJson('/api/auth/login', ['login' => $u->username, 'password' => 'Password123'])->assertOk();
        $this->assertSame('active', $u->fresh()->status);

        // The hourly command does the same for people who never come back.
        Carbon::setTestNow();
        $v = $this->makeUser();
        $this->as($this->admin)->postJson("/api/admin/users/{$v->id}/suspend", ['reason' => 'Review', 'until' => now()->addDay()->toDateString()])->assertOk();
        Carbon::setTestNow(now()->addDays(2));
        $this->artisan('accounts:lift-expired')->assertSuccessful();
        $this->assertSame('active', $v->fresh()->status);
        Carbon::setTestNow();
    }

    public function test_revoke_is_permanent_until_an_admin_reinstates(): void
    {
        $u = $this->makeUser();
        $this->as($this->admin)->postJson("/api/admin/users/{$u->id}/revoke", [])->assertStatus(422)->assertJsonValidationErrors('reason');
        $this->as($this->admin)->postJson("/api/admin/users/{$u->id}/revoke", ['reason' => 'Fraud ring'])->assertOk()->assertJsonPath('user.status', 'revoked');
        Carbon::setTestNow(now()->addYears(3));
        $this->guest()->postJson('/api/auth/login', ['login' => $u->username, 'password' => 'Password123'])->assertStatus(403)->assertJsonPath('block.type', 'revoked');
        Carbon::setTestNow();
        $this->as($this->admin)->postJson("/api/admin/users/{$u->id}/reinstate", ['note' => 'Appeal accepted'])->assertOk()->assertJsonPath('user.status', 'active');
        $this->guest()->postJson('/api/auth/login', ['login' => $u->username, 'password' => 'Password123'])->assertOk();
    }

    public function test_admins_and_yourself_cannot_be_blocked(): void
    {
        $other = $this->makeUser(['role' => 'admin']);
        $this->as($this->admin)->postJson("/api/admin/users/{$other->id}/revoke", ['reason' => 'x'])->assertStatus(422);
        $this->as($this->admin)->postJson("/api/admin/users/{$this->admin->id}/revoke", ['reason' => 'x'])->assertStatus(422);
    }

    public function test_blocked_host_listings_are_hidden_and_upcoming_trips_flagged(): void
    {
        $v = $this->vehicle();
        $host = $v->host;
        $renter = $this->verifiedRenter();
        $ref = $this->book($renter, $v)->assertCreated()->json('reference');
        $this->guest()->getJson('/api/vehicles')->assertJsonCount(1, 'data');

        $this->as($this->admin)->postJson("/api/admin/users/{$host->id}/suspend", ['reason' => 'Unsafe vehicle', 'until' => now()->addDays(5)->toDateString()])->assertOk();

        $this->guest()->getJson('/api/vehicles')->assertJsonCount(0, 'data');
        $this->guest()->getJson("/api/vehicles/{$v->id}")->assertNotFound();
        $b = Booking::where('reference', $ref)->first();
        $this->assertSame('host_blocked', $b->admin_flag);
        $this->assertDatabaseHas('user_notifications', ['user_id' => $renter->id, 'title' => 'Your host is under review']);
        $this->assertDatabaseHas('user_notifications', ['user_id' => $this->admin->id, 'title' => 'Trips need a decision']);

        // The admin sees it in the flagged list and can cancel with a full refund.
        $this->as($this->admin)->getJson('/api/admin/bookings?status=flagged')->assertOk()->assertJsonPath('data.0.admin_flag', 'host_blocked')->assertJsonPath('counts.flagged', 1);
        $paid = $b->amount_paid;
        $res = $this->as($this->admin)->postJson("/api/admin/bookings/{$ref}/cancel", ['reason' => 'Host account suspended'])->assertOk();
        $this->assertSame('cancelled', $res->json('status'));
        $this->assertSame($paid, (int) $b->payments()->where('type', 'refund')->sum('amount'));

        // Reinstating brings the listing back.
        $this->as($this->admin)->postJson("/api/admin/users/{$host->id}/reinstate")->assertOk();
        $this->guest()->getJson('/api/vehicles')->assertJsonCount(1, 'data');
    }

    public function test_blocked_renter_cannot_book_and_their_trips_are_flagged(): void
    {
        $v = $this->vehicle();
        $renter = $this->verifiedRenter();
        $ref = $this->book($renter, $v)->assertCreated()->json('reference');
        $this->as($this->admin)->postJson("/api/admin/users/{$renter->id}/suspend", ['reason' => 'Fake ID', 'until' => now()->addDays(10)->toDateString()])->assertOk();

        $this->assertSame('renter_blocked', Booking::where('reference', $ref)->value('admin_flag'));
        $this->as($renter)->postJson('/api/bookings', $this->bookingPayload($v, ['pickup_at' => now()->addDays(20)->toIso8601String(), 'return_at' => now()->addDays(22)->toIso8601String()]))->assertStatus(403);

        $this->as($this->admin)->postJson("/api/admin/users/{$renter->id}/reinstate")->assertOk();
        $this->assertNull(Booking::where('reference', $ref)->value('admin_flag'));
    }

    public function test_every_admin_action_is_logged_with_who_what_and_why(): void
    {
        $u = $this->makeUser();
        $this->as($this->admin)->postJson("/api/admin/users/{$u->id}/suspend", ['reason' => 'Fake documents', 'until' => now()->addDays(7)->toDateString()])->assertOk();
        $this->as($this->admin)->postJson("/api/admin/users/{$u->id}/reinstate", ['note' => 'Cleared'])->assertOk();

        $log = AdminAuditLog::orderBy('id')->get();
        $this->assertSame(['user.suspend', 'user.reinstate'], $log->pluck('action')->all());
        $this->assertSame($this->admin->id, $log[0]->actor_id);
        $this->assertSame('Fake documents', $log[0]->reason);
        $this->assertStringContainsString($u->username, $log[0]->target_label);

        $res = $this->as($this->admin)->getJson('/api/admin/audit-log')->assertOk();
        $this->assertSame('user.reinstate', $res->json('data.0.action'));
        $this->assertSame('Site Admin', $res->json('data.0.actor'));
        $this->as($this->admin)->getJson('/api/admin/audit-log?action=user.suspend')->assertJsonCount(1, 'data');
        $this->as($u)->getJson('/api/admin/audit-log')->assertForbidden();
    }
}
