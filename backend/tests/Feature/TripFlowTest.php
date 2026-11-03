<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Incident;
use App\Models\InspectionPhoto;
use App\Models\Payment;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\PricingService;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

/** Phase 5: guided photo check-in and check-out, host review, excess hours, extensions and the "car not returned" report. */
class TripFlowTest extends TestCase
{
    /** A confirmed booking whose check-in window is open. Returns [host, renter, reference, vehicle]. */
    protected function confirmed(array $times = []): array
    {
        $host = $this->host();
        $v = $this->vehicle([], $host);
        $u = $this->verifiedRenter();
        $ref = $this->book($u, $v)->assertCreated()->json('reference');
        Booking::where('reference', $ref)->update($times + ['pickup_at' => now()->subHour(), 'return_at' => now()->addDay()]);
        return [$host, $u, $ref, $v];
    }

    /** A trip that is running: checked in with photos and handed over. */
    protected function running(array $times = []): array
    {
        [$host, $u, $ref, $v] = $this->confirmed($times);
        $this->inspect($u, $ref, 'checkin', ['odometer' => 12000, 'fuel_level' => 100])->assertCreated();
        $this->as($host)->postJson("/api/host/bookings/{$ref}/pickup", ['odometer' => 12000, 'fuel_level' => 100, 'checklist' => ['exterior' => true]])->assertOk();
        return [$host, $u, $ref, $v];
    }

    public function test_check_in_opens_twelve_hours_before_pickup_and_needs_every_shot(): void
    {
        [$host, $u, $ref] = $this->confirmed(['pickup_at' => now()->addDays(2), 'return_at' => now()->addDays(4)]);
        $this->as($u)->post("/api/bookings/{$ref}/inspection/checkin/photos", ['file' => $this->fakeImage(), 'angle' => 'front', 'live' => true], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonValidationErrors('booking');

        Booking::where('reference', $ref)->update(['pickup_at' => now()->addHours(5)]);
        $this->as($u)->getJson("/api/bookings/{$ref}/inspection/checkin")->assertOk()->assertJsonCount(10, 'angles')->assertJsonPath('can_start', true);
        $this->as($u)->post("/api/bookings/{$ref}/inspection/checkin/photos", ['file' => $this->fakeImage(), 'angle' => 'front', 'live' => true], ['Accept' => 'application/json'])->assertCreated();

        $res = $this->as($u)->postJson("/api/bookings/{$ref}/inspection/checkin", ['odometer' => 5000, 'fuel_level' => 50])->assertStatus(422)->assertJsonValidationErrors('photos');
        $this->assertStringContainsString('Rear', $res->json('errors.photos.0'));
        $this->as($u)->postJson("/api/bookings/{$ref}/inspection/checkin", ['odometer' => 5000, 'fuel_level' => 40])->assertStatus(422); // not E, 1/4, 1/2, 3/4 or F

        // Only the renter on the booking can do it.
        $this->as($this->verifiedRenter())->getJson("/api/bookings/{$ref}/inspection/checkin")->assertNotFound();
        $this->as($host)->getJson("/api/bookings/{$ref}/inspection/checkin")->assertNotFound();
    }

    public function test_the_trip_cannot_start_without_check_in_and_photos_stay_private_and_unchangeable(): void
    {
        [$host, $u, $ref] = $this->confirmed();
        $this->as($host)->postJson("/api/host/bookings/{$ref}/pickup", ['odometer' => 1, 'fuel_level' => 100, 'checklist' => ['exterior' => true]])->assertStatus(422)->assertJsonValidationErrors('booking');

        $this->inspect($u, $ref, 'checkin', ['odometer' => 7000, 'fuel_level' => 75, 'notes' => 'Small scratch on the rear bumper'])->assertCreated()
            ->assertJsonPath('trip.checkin.odometer', 7000)->assertJsonPath('trip.checkin.host_status', 'pending')->assertJsonCount(10, 'trip.checkin.photos');
        $photo = InspectionPhoto::first();
        $this->assertSame(64, strlen($photo->sha256));
        $this->assertTrue($photo->live);
        $this->assertSame(10.3157, $photo->lat);
        $this->assertNotNull($photo->device_time);
        $this->assertNotNull($photo->created_at); // server time

        // Visible to the renter, the host and admins. Nobody else.
        $id = $photo->media_id;
        $this->as($u)->get("/api/media/{$id}")->assertOk();
        $this->as($host)->get("/api/media/{$id}")->assertOk();
        $this->as($this->admin())->get("/api/media/{$id}")->assertOk();
        $this->as($this->verifiedRenter())->get("/api/media/{$id}")->assertNotFound();
        $this->as($this->host())->get("/api/media/{$id}")->assertNotFound();
        $this->guest()->get("/api/media/{$id}")->assertNotFound();

        // Grids ask for a small copy; the original stays full size and the copy is cheaper to send.
        $full = $this->as($u)->get("/api/media/{$id}")->getContent();
        $small = $this->as($u)->get("/api/media/{$id}?w=300")->assertOk();
        $this->assertLessThan(strlen($full), strlen($small->getContent()));
        $this->assertSame(300, getimagesizefromstring($small->getContent())[0]);
        $this->assertStringContainsString('max-age=86400', $small->headers->get('Cache-Control'));

        // Submitted photos never change: a second submit, a retake and a delete are all refused.
        $this->as($u)->postJson("/api/bookings/{$ref}/inspection/checkin", ['odometer' => 7000, 'fuel_level' => 75])->assertStatus(422);
        $this->as($u)->post("/api/bookings/{$ref}/inspection/checkin/photos", ['file' => $this->fakeImage(), 'angle' => 'front'], ['Accept' => 'application/json'])->assertStatus(422);
        $this->as($u)->deleteJson("/api/bookings/{$ref}/inspection/checkin/photos/{$photo->id}")->assertStatus(422);
        $this->assertSame(10, InspectionPhoto::count());
        // ...but extra damage close-ups can still be added, and the host can add their own.
        $this->as($u)->post("/api/bookings/{$ref}/inspection/checkin/photos", ['file' => $this->fakeImage(), 'angle' => 'damage', 'note' => 'Scratch'], ['Accept' => 'application/json'])->assertCreated();
        $this->as($host)->post("/api/host/bookings/{$ref}/checkin/photos", ['file' => $this->fakeImage(), 'live' => true], ['Accept' => 'application/json'])->assertCreated();
        $this->assertSame(12, InspectionPhoto::count());
        $this->assertSame(12, InspectionPhoto::whereNotNull('inspection_id')->count());
        $this->as($u)->post("/api/host/bookings/{$ref}/checkin/photos", ['file' => $this->fakeImage()], ['Accept' => 'application/json'])->assertForbidden();

        // Uploaded-not-live photos are marked as such.
        [$h2, $u2, $ref2] = $this->confirmed();
        $this->as($u2)->post("/api/bookings/{$ref2}/inspection/checkin/photos", ['file' => $this->fakeImage(), 'angle' => 'rear', 'live' => false], ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('live', false);
        // A retake of a draft replaces it.
        $this->as($u2)->post("/api/bookings/{$ref2}/inspection/checkin/photos", ['file' => $this->fakeImage(), 'angle' => 'rear', 'live' => true], ['Accept' => 'application/json'])->assertCreated();
        $this->assertSame(1, InspectionPhoto::where('booking_id', Booking::where('reference', $ref2)->value('id'))->count());

        // The host can confirm the condition, once.
        $this->as($host)->postJson("/api/host/bookings/{$ref}/checkin/confirm", ['notes' => 'Agree, scratch was there'])->assertOk()->assertJsonPath('trip.checkin.host_status', 'confirmed');
        $this->as($host)->postJson("/api/host/bookings/{$ref}/checkin/confirm")->assertStatus(422);
        $this->as($host)->postJson("/api/host/bookings/{$ref}/pickup", ['odometer' => 7000, 'fuel_level' => 75, 'checklist' => ['exterior' => true]])->assertOk()->assertJsonPath('status', 'active');
    }

    public function test_unanswered_check_ins_are_accepted_after_the_window(): void
    {
        [$host, $u, $ref] = $this->confirmed();
        $this->inspect($u, $ref, 'checkin')->assertCreated();
        $this->artisan('trips:sweep')->assertSuccessful();
        $this->as($host)->getJson("/api/host/bookings/{$ref}")->assertJsonPath('trip.checkin.host_status', 'pending');
        $this->travel(13)->hours();
        $this->artisan('trips:sweep')->assertSuccessful();
        $this->as($host)->getJson("/api/host/bookings/{$ref}")->assertJsonPath('trip.checkin.host_status', 'auto_accepted');
        // After the window the host can no longer add photos.
        $this->as($host)->post("/api/host/bookings/{$ref}/checkin/photos", ['file' => $this->fakeImage()], ['Accept' => 'application/json'])->assertStatus(422);
    }

    public function test_check_out_shows_the_check_in_photos_as_ghosts_and_checks_the_odometer(): void
    {
        [$host, $u, $ref] = $this->running();
        $wizard = $this->as($u)->getJson("/api/bookings/{$ref}/inspection/checkout")->assertOk()->assertJsonPath('can_start', true)->assertJsonPath('checkin_odometer', 12000);
        $this->assertCount(10, $wizard->json('ghosts'));
        $this->assertArrayHasKey('front', $wizard->json('ghosts'));

        $this->inspect($u, $ref, 'checkout', ['odometer' => 11000])->assertStatus(422)->assertJsonValidationErrors('odometer');
        $this->inspect($u, $ref, 'checkout', ['odometer' => 12450, 'fuel_level' => 50])->assertCreated()
            ->assertJsonPath('trip.checkout.odometer', 12450)->assertJsonPath('trip.late.fee', 0)->assertJsonPath('status', 'active');
        $b = Booking::where('reference', $ref)->first();
        $this->assertNotNull($b->checkout_submitted_at);
        $this->assertNotNull($b->host_review_due_at);
        $this->assertSame(1, UserNotification::where('user_id', $host->id)->where('title', 'The car was returned')->count());
    }

    public function test_host_accepts_the_return_and_the_deposit_is_settled(): void
    {
        [$host, $u, $ref] = $this->running();
        $this->inspect($u, $ref, 'checkout', ['odometer' => 12400, 'fuel_level' => 100])->assertCreated();
        $this->as($host)->postJson("/api/host/bookings/{$ref}/return/review", ['decision' => 'accept'])->assertOk()
            ->assertJsonPath('status', 'completed')->assertJsonPath('deposit_status', 'released')->assertJsonPath('deposit_refunded', 5000);
        $this->assertNull(Incident::first());
        $this->as($host)->postJson("/api/host/bookings/{$ref}/return/review", ['decision' => 'accept'])->assertStatus(422);
    }

    public function test_excess_hours_are_calculated_from_the_server_time_of_check_out_and_taken_from_the_deposit(): void
    {
        [$host, $u, $ref] = $this->running(['pickup_at' => now()->subDays(2), 'return_at' => now()->subHours(7)->addMinutes(20)]);
        // 6h40m late = billed as 7 hours: past the 5-hour threshold, so it counts as one full extra day (₱3,200), not 7 × ₱320.
        $res = $this->inspect($u, $ref, 'checkout', ['odometer' => 12100])->assertCreated()
            ->assertJsonPath('trip.late.hours', 7)->assertJsonPath('trip.late.fee', 3200)->assertJsonPath('trip.late.extra_day_applied', true)
            ->assertJsonPath('trip.late.grace_minutes', 30)->assertJsonPath('trip.late.per_hour', 320);
        $this->assertSame(3200, Booking::where('reference', $ref)->value('late_fee'));

        $this->as($host)->postJson("/api/host/bookings/{$ref}/return/review", ['decision' => 'accept'])->assertOk()
            ->assertJsonPath('late_fee', 3200)->assertJsonPath('deposit_refunded', 1800)->assertJsonPath('balance_due', 0);
        $this->assertSame(3200, (int) Payment::where('type', 'late_fee')->sum('amount'));
    }

    public function test_excess_hour_rule(): void
    {
        $v = $this->vehicle();
        $p = app(PricingService::class);
        $due = now()->startOfHour();
        $this->assertSame(0, $p->lateFee($v, $due, $due->copy()->addMinutes(30))['fee']); // inside the 30-minute grace
        $this->assertSame(320, $p->lateFee($v, $due, $due->copy()->addMinutes(31))['fee']); // 1 hour, per-hour rate
        $this->assertSame(1280, $p->lateFee($v, $due, $due->copy()->addHours(4))['fee']);
        $this->assertSame(3200, $p->lateFee($v, $due, $due->copy()->addHours(5))['fee']); // 5 hours = one full day
        $this->assertSame(3200, $p->lateFee($v, $due, $due->copy()->addHours(23))['fee']); // 23 hours is still one day, never more
        $day = $p->lateFee($v, $due, $due->copy()->addHours(26));
        $this->assertSame(3200 + 2 * 320, $day['fee']); // a day and 2 hours
        $this->assertFalse($day['extra_day_applied']);
        $listing = $this->vehicle(['grace_minutes' => 10]);
        $this->assertSame(320, $p->lateFee($listing, $due, $due->copy()->addMinutes(11))['fee']); // the listing's own grace period
    }

    public function test_host_reports_an_issue_with_pins_and_the_deposit_stays_held(): void
    {
        [$host, $u, $ref] = $this->running();
        $this->inspect($u, $ref, 'checkout', ['odometer' => 12300])->assertCreated();
        $this->as($host)->postJson("/api/host/bookings/{$ref}/return/review", ['decision' => 'issue', 'type' => 'damage'])->assertStatus(422);
        $pins = [['angle' => 'front', 'x' => 0.4, 'y' => 0.6, 'note' => 'New dent'], ['angle' => 'engine', 'x' => 0.5, 'y' => 0.5, 'note' => 'Battery looks swapped']];
        $this->as($host)->postJson("/api/host/bookings/{$ref}/return/review", ['decision' => 'issue', 'type' => 'missing_parts', 'description' => 'Front bumper dented and the battery is not the original.', 'amount' => 6000, 'pins' => $pins])->assertOk()
            ->assertJsonPath('deposit_status', 'on_hold')->assertJsonPath('display_status', 'under_review');
        $i = Incident::first();
        $this->assertSame('missing_parts', $i->type);
        $this->assertSame($pins[0]['note'], $i->pins[0]['note']);
        // The admin sees the dispute with the pins and the booking's photo sets.
        $admin = $this->admin();
        $d = $this->as($admin)->getJson('/api/admin/disputes')->assertOk()->json('data.0');
        $this->assertCount(2, $d['pins']);
        $b = $this->as($admin)->getJson("/api/admin/bookings/{$ref}")->assertOk();
        $this->assertCount(10, $b->json('trip.checkin.photos'));
        $this->assertCount(10, $b->json('trip.checkout.photos'));
    }

    public function test_an_unreviewed_return_completes_by_itself_after_the_window(): void
    {
        [$host, $u, $ref] = $this->running();
        $this->inspect($u, $ref, 'checkout', ['odometer' => 12200])->assertCreated();
        $this->artisan('trips:sweep')->assertSuccessful();
        $this->assertSame('active', Booking::where('reference', $ref)->value('status'));
        $this->travel(25)->hours();
        $this->artisan('trips:sweep')->assertSuccessful();
        $b = Booking::where('reference', $ref)->first();
        $this->assertSame('completed', $b->status);
        $this->assertSame('released', $b->deposit_status);
        $this->assertSame(0, Incident::count());
    }

    public function test_extension_request_approval_and_decline(): void
    {
        [$host, $u, $ref, $v] = $this->running(['return_at' => now()->addHours(5)]);
        $new = now()->addDay()->toIso8601String();
        $this->as($u)->postJson("/api/bookings/{$ref}/extension", ['return_at' => now()->addHours(2)->toIso8601String()])->assertStatus(422)->assertJsonValidationErrors('return_at'); // earlier than now+5h
        $this->as($u)->postJson("/api/bookings/{$ref}/extension", ['return_at' => now()->addDays(20)->toIso8601String()])->assertStatus(422);
        $this->as($u)->postJson("/api/bookings/{$ref}/extension", ['return_at' => $new, 'note' => 'Flight delayed'])->assertCreated()->assertJsonPath('trip.extension.status', 'pending');
        $this->as($u)->postJson("/api/bookings/{$ref}/extension", ['return_at' => $new])->assertStatus(422); // one at a time

        $id = Booking::where('reference', $ref)->first()->extensions()->first()->id;
        $this->as($u)->postJson("/api/host/bookings/{$ref}/extensions/{$id}", ['approve' => true])->assertForbidden();
        $this->as($host)->postJson("/api/host/bookings/{$ref}/extensions/{$id}", ['approve' => true])->assertOk()->assertJsonPath('trip.extension.status', 'approved');
        $this->assertEqualsWithDelta(now()->addDay()->timestamp, Booking::where('reference', $ref)->first()->return_at->timestamp, 5);
        $this->as($host)->postJson("/api/host/bookings/{$ref}/extensions/{$id}", ['approve' => false])->assertStatus(422); // already answered

        // A declined one leaves the return time alone.
        $this->as($u)->postJson("/api/bookings/{$ref}/extension", ['return_at' => now()->addDays(2)->toIso8601String()])->assertCreated();
        $id2 = Booking::where('reference', $ref)->first()->extensions()->first()->id;
        $this->as($host)->postJson("/api/host/bookings/{$ref}/extensions/{$id2}", ['approve' => false])->assertOk()->assertJsonPath('trip.extension.status', 'declined');
        $this->assertEqualsWithDelta(now()->addDay()->timestamp, Booking::where('reference', $ref)->first()->return_at->timestamp, 5);
    }

    public function test_extension_cannot_overlap_someone_elses_booking(): void
    {
        [$host, $u, $ref, $v] = $this->running(['return_at' => now()->addHours(5)]);
        $other = $this->verifiedRenter();
        $this->book($other, $v, ['pickup_at' => now()->addHours(30)->toIso8601String(), 'return_at' => now()->addDays(3)->toIso8601String()])->assertCreated();
        $this->as($u)->postJson("/api/bookings/{$ref}/extension", ['return_at' => now()->addDays(2)->toIso8601String()])->assertStatus(422)->assertJsonValidationErrors('return_at');
    }

    public function test_return_reminder_goes_out_once_an_hour_before(): void
    {
        [$host, $u, $ref] = $this->running(['return_at' => now()->addMinutes(50)]);
        $this->artisan('trips:sweep')->assertSuccessful();
        $this->artisan('trips:sweep')->assertSuccessful();
        $this->assertSame(1, UserNotification::where('user_id', $u->id)->where('title', 'Return time is near')->count());

        [, $u2] = $this->running(['return_at' => now()->addHours(4)]);
        $this->artisan('trips:sweep')->assertSuccessful();
        $this->assertSame(0, UserNotification::where('user_id', $u2->id)->where('title', 'Return time is near')->count());
    }

    public function test_car_not_returned_flags_a_possible_theft_and_puts_the_renter_on_hold(): void
    {
        $admin = $this->admin();
        [$host, $u, $ref] = $this->running(['pickup_at' => now()->subDays(2), 'return_at' => now()->subHours(2)]);
        $this->as($host)->postJson("/api/host/bookings/{$ref}/not-returned")->assertStatus(422); // only 2 hours overdue, needs 3
        $this->as($host)->getJson("/api/host/bookings/{$ref}")->assertJsonPath('trip.can_report_not_returned', false);

        Booking::where('reference', $ref)->update(['return_at' => now()->subHours(4)]);
        $this->as($host)->getJson("/api/host/bookings/{$ref}")->assertJsonPath('trip.can_report_not_returned', true);
        $this->as($u)->postJson("/api/host/bookings/{$ref}/not-returned")->assertForbidden();
        $this->as($host)->postJson("/api/host/bookings/{$ref}/not-returned")->assertOk();

        $b = Booking::where('reference', $ref)->first();
        $this->assertSame('possible_theft', $b->admin_flag);
        $this->assertSame('suspended', $u->fresh()->status);
        $this->assertSame('theft', Incident::first()->type);
        $this->assertSame(1, UserNotification::where('user_id', $admin->id)->where('title', 'like', 'URGENT: possible vehicle theft')->count());
        $this->assertSame(1, UserNotification::where('user_id', $u->id)->where('title', 'Your account is on hold')->count());
        $mail = app('mailer')->getSymfonyTransport()->messages()->filter(fn ($m) => str_contains($m->getOriginalMessage()->getSubject(), 'was not returned'));
        $this->assertCount(1, $mail);
        $this->as($host)->postJson("/api/host/bookings/{$ref}/not-returned")->assertStatus(422); // once only
    }

    public function test_an_approved_extension_stops_the_not_returned_report(): void
    {
        [$host, $u, $ref] = $this->running(['pickup_at' => now()->subDays(2), 'return_at' => now()->addHours(2)]);
        $this->as($u)->postJson("/api/bookings/{$ref}/extension", ['return_at' => now()->addDays(2)->toIso8601String()])->assertCreated();
        $id = Booking::where('reference', $ref)->first()->extensions()->first()->id;
        $this->as($host)->postJson("/api/host/bookings/{$ref}/extensions/{$id}", ['approve' => true])->assertOk();
        $this->travel(20)->hours();
        $this->as($host)->postJson("/api/host/bookings/{$ref}/not-returned")->assertStatus(422);
    }

    public function test_renter_can_report_a_stolen_car_with_photos_and_location(): void
    {
        $admin = $this->admin();
        [$host, $u, $ref] = $this->running();
        $mine = $this->as($u)->post('/api/media', ['file' => $this->fakeImage('scene.jpg', 800, 600), 'purpose' => 'incident'], ['Accept' => 'application/json'])->assertCreated()->json('id');
        $other = $this->verifiedRenter();
        $theirs = $this->as($other)->post('/api/media', ['file' => $this->fakeImage('x.jpg', 800, 600), 'purpose' => 'incident'], ['Accept' => 'application/json'])->json('id');

        $this->as($u)->postJson("/api/bookings/{$ref}/incidents", ['type' => 'stolen', 'description' => 'The car was taken from the parking lot.', 'photo_ids' => [$mine, $theirs], 'lat' => 10.3, 'lng' => 123.9])->assertCreated();
        $i = Incident::first();
        $this->assertSame('stolen', $i->type);
        $this->assertSame([$mine], $i->photo_ids); // someone else's photo is dropped
        $this->assertEquals(10.3, $i->lat);
        $this->assertSame(1, UserNotification::where('user_id', $admin->id)->where('kind', 'danger')->count());
        $this->assertSame(1, UserNotification::where('user_id', $host->id)->where('kind', 'danger')->count());
    }

    public function test_evidence_packet_is_admin_only_complete_and_logged(): void
    {
        [$host, $u, $ref] = $this->running(['pickup_at' => now()->subDays(2), 'return_at' => now()->subHours(1)]);
        $this->inspect($u, $ref, 'checkout', ['odometer' => 12300])->assertCreated();
        $admin = $this->admin();

        $this->as($u)->get("/api/admin/bookings/{$ref}/evidence.pdf")->assertForbidden();
        $this->as($host)->get("/api/admin/bookings/{$ref}/evidence.pdf")->assertForbidden();
        $r = $this->as($admin)->get("/api/admin/bookings/{$ref}/evidence.pdf")->assertOk();
        $this->assertSame('application/pdf', $r->headers->get('Content-Type'));
        $this->assertStringStartsWith('%PDF', $r->getContent());
        $this->assertGreaterThan(20_000, strlen($r->getContent())); // photos are in there
        $this->as($admin)->get("/api/admin/bookings/{$ref}/evidence.pdf")->assertOk();
        $this->assertSame(2, \App\Models\AdminAuditLog::where('action', 'evidence.download')->count());
    }

    public function test_admin_can_clear_the_theft_flag(): void
    {
        $admin = $this->admin();
        [$host, $u, $ref] = $this->running(['pickup_at' => now()->subDays(2), 'return_at' => now()->subHours(5)]);
        $this->as($host)->postJson("/api/host/bookings/{$ref}/not-returned")->assertOk();
        $this->as($admin)->postJson("/api/admin/bookings/{$ref}/clear-flag", ['note' => 'x'])->assertStatus(422);
        $this->as($admin)->postJson("/api/admin/bookings/{$ref}/clear-flag", ['note' => 'Renter reached, car is safe'])->assertOk()->assertJsonPath('admin_flag', null);
        $this->as($u)->postJson("/api/admin/bookings/{$ref}/clear-flag", ['note' => 'trying it'])->assertForbidden();
    }
}
