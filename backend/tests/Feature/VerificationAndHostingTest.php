<?php

namespace Tests\Feature;

use App\Models\DriverLicense;
use App\Models\User;
use App\Models\VerificationDecision;
use App\Services\VerificationChecker;
use App\Support\ImageHash;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class VerificationAndHostingTest extends TestCase
{
    protected function upload(User $u, string $purpose, string $name = 'a.jpg', int $w = 1200, int $h = 800): int
    {
        return $this->as($u)->post('/api/media', ['file' => $this->fakeImage($name, $w, $h), 'purpose' => $purpose], ['Accept' => 'application/json'])
            ->assertCreated()->json('id');
    }

    /** A JPEG with a distinctive, seed-based pattern (plain fake images are all identical blank frames). */
    protected function patternFile(int $seed, int $w = 1200, int $h = 800): UploadedFile
    {
        mt_srand($seed);
        $img = imagecreatetruecolor($w, $h);
        imagefill($img, 0, 0, imagecolorallocate($img, mt_rand(0, 255), mt_rand(0, 255), mt_rand(0, 255)));
        for ($i = 0; $i < 30; $i++) {
            imagefilledrectangle($img, (int) (mt_rand(0, 1000) / 1000 * $w), (int) (mt_rand(0, 1000) / 1000 * $h), (int) (mt_rand(0, 1000) / 1000 * $w), (int) (mt_rand(0, 1000) / 1000 * $h), imagecolorallocate($img, mt_rand(0, 255), mt_rand(0, 255), mt_rand(0, 255)));
        }
        ob_start();
        imagejpeg($img, null, 85);
        return UploadedFile::fake()->createWithContent("p{$seed}.jpg", ob_get_clean());
    }

    protected function uploadPattern(User $u, string $purpose, int $seed, int $w = 1200, int $h = 800): int
    {
        return $this->as($u)->post('/api/media', ['file' => $this->patternFile($seed, $w, $h), 'purpose' => $purpose], ['Accept' => 'application/json'])->assertCreated()->json('id');
    }

    /** What a healthy browser report looks like. */
    protected function goodClientChecks(): array
    {
        $checks = [];
        foreach (array_keys(VerificationChecker::DEVICE_CHECKS) as $key) {
            $checks[] = ['key' => $key, 'status' => 'pass', 'value' => 0.9, 'detail' => 'ok'];
        }
        return [
            'version' => 1,
            'checks' => $checks,
            'face_similarity' => 0.82, 'liveness' => 0.91, 'antispoof' => 0.93,
            'ocr_keyword_hits' => ['REPUBLIC OF THE PHILIPPINES', "DRIVER'S LICENSE"],
            'ocr_text' => ['front' => "REPUBLIC OF THE PHILIPPINES DRIVER'S LICENSE N01-23-456789", 'back' => 'RESTRICTIONS CONDITIONS'],
            'faces' => ['license' => ['x' => 0.1, 'y' => 0.2, 'w' => 0.2, 'h' => 0.4], 'selfie' => ['x' => 0.3, 'y' => 0.2, 'w' => 0.3, 'h' => 0.4]],
        ];
    }

    protected function payload(User $u, array $over = []): array
    {
        return array_merge([
            'license_type' => 'ph', 'license_number' => 'n01-23-456789', 'full_name' => $u->name,
            'birthdate' => '1998-04-12', 'expiry_date' => now()->addYears(3)->toDateString(), 'restriction_codes' => ['A', 'B'],
            'address' => 'Lahug, Cebu City',
            'front_media_id' => $this->uploadPattern($u, 'license_front', 1),
            'back_media_id' => $this->uploadPattern($u, 'license_back', 2),
            'selfie_media_id' => $this->uploadPattern($u, 'selfie', 3, 900, 1200),
            'client_checks' => $this->goodClientChecks(),
            'confirm_accurate' => true,
        ], $over);
    }

    protected function submitAndFetch(User $u, array $payload): array
    {
        $this->as($u)->postJson('/api/verification', $payload)->assertCreated();
        return $this->as($this->admin())->getJson('/api/admin/verifications?status=all')->assertOk()->json('data.0');
    }

    public function test_license_submission_runs_automated_checks_and_admin_approves(): void
    {
        $u = $this->makeUser(['name' => 'Vincent Laroco']);
        $payload = $this->payload($u);
        $this->as($u)->postJson('/api/verification', $payload)->assertCreated()->assertJsonPath('status', 'pending');
        $this->as($u)->postJson('/api/verification', $payload)->assertStatus(422); // already in review

        // Private documents are hidden from other users.
        $stranger = $this->makeUser();
        $this->as($stranger)->get('/api/media/'.$payload['front_media_id'])->assertNotFound();

        $admin = $this->admin();
        $item = $this->as($admin)->getJson('/api/admin/verifications')->assertOk()->json('data.0');
        $this->assertSame('good', $item['auto_label']);
        $this->assertGreaterThanOrEqual(90, $item['auto_score']);
        $this->assertSame('N01-23-456789', $item['license_number']);
        $this->assertNull($item['client_checks']); // list stays light
        $detail = $this->as($admin)->getJson('/api/admin/verifications/'.$item['id'])->assertOk()->json();
        $this->assertSame(0.82, $detail['client_checks']['face_similarity']);
        $rows = collect($detail['auto_checks'])->keyBy('key');
        $this->assertSame('pass', $rows['near_duplicate']['result']);
        $this->assertSame('server', $rows['near_duplicate']['source']);
        $this->assertSame('device', $rows['face_match']['source']);
        $this->assertSame('pass', $rows['address']['result']);
        $this->as($admin)->get('/api/media/'.$payload['front_media_id'])->assertOk();
        $this->as($admin)->postJson("/api/admin/verifications/{$item['id']}/approve")->assertOk()->assertJsonPath('status', 'approved');
        $this->assertTrue($u->fresh()->isVerified());
    }

    public function test_checker_flags_problems_and_admin_can_reject(): void
    {
        $u = $this->makeUser(['name' => 'Maria Clara']);
        $item = $this->submitAndFetch($u, $this->payload($u, [
            'license_number' => '12345', 'full_name' => 'Pedro Penduko',
            'birthdate' => now()->subYears(19)->toDateString(), 'expiry_date' => now()->subDay()->toDateString(),
            'front_media_id' => $this->uploadPattern($u, 'license_front', 11, 500, 350),
        ]));
        $results = collect($item['auto_checks'])->pluck('result', 'key');
        $this->assertSame('fail', $results['format']);
        $this->assertSame('fail', $results['expiry']);
        $this->assertSame('fail', $results['age']);
        $this->assertSame('fail', $results['name']);
        $this->assertSame('warn', $results['quality']);
        $this->assertSame('reject', $item['auto_label']); // expired license is critical
        $this->assertLessThanOrEqual(30, $item['auto_score']);
        // An expired license is a critical failure, so it was rejected automatically with a reason for the renter.
        $this->assertSame('rejected', $item['status']);
        $this->assertSame('reject', $item['auto_decision']);
        $this->assertNotEmpty($item['rejection_reason']);
        $this->assertSame('rejected', $u->fresh()->verification_status);
        $admin = User::where('role', 'admin')->firstOrFail();
        $this->as($admin)->postJson("/api/admin/verifications/{$item['id']}/reject", ['reason' => 'x'])->assertStatus(422); // already decided
    }

    public function test_submission_without_browser_checks_is_never_shown_as_good(): void
    {
        $u = $this->makeUser();
        $item = $this->submitAndFetch($u, $this->payload($u, ['client_checks' => null]));
        $results = collect($item['auto_checks'])->pluck('result', 'key');
        foreach (['front_face', 'selfie_face', 'selfie_liveness', 'selfie_antispoof', 'face_match'] as $k) {
            $this->assertSame('not_checked', $results[$k], $k);
        }
        $this->assertSame('incomplete', $item['auto_label']);
        $this->assertLessThanOrEqual(60, $item['auto_score']);
    }

    public function test_failed_face_or_liveness_checks_cap_the_score(): void
    {
        $u = $this->makeUser();
        $checks = $this->goodClientChecks();
        foreach ($checks['checks'] as &$c) {
            if (in_array($c['key'], ['face_match', 'selfie_antispoof'], true)) { $c['status'] = 'fail'; $c['value'] = 0.2; }
        }
        unset($c);
        $item = $this->submitAndFetch($u, $this->payload($u, ['client_checks' => $checks]));
        $this->assertSame('reject', $item['auto_label']);
        $this->assertLessThanOrEqual(30, $item['auto_score']);
    }

    public function test_device_pass_without_a_score_is_not_trusted(): void
    {
        $u = $this->makeUser();
        $checks = $this->goodClientChecks();
        foreach ($checks['checks'] as &$c) {
            if ($c['key'] === 'face_match') $c['value'] = null;
        }
        unset($c);
        $item = $this->submitAndFetch($u, $this->payload($u, ['client_checks' => $checks]));
        $this->assertSame('not_checked', collect($item['auto_checks'])->pluck('result', 'key')['face_match']);
        $this->assertSame('incomplete', $item['auto_label']);
    }

    public function test_near_duplicate_front_and_selfie_are_caught(): void
    {
        $u = $this->makeUser();
        $item = $this->submitAndFetch($u, $this->payload($u, [
            'front_media_id' => $this->uploadPattern($u, 'license_front', 5),
            'selfie_media_id' => $this->uploadPattern($u, 'selfie', 5, 1000, 667), // same picture, different size
        ]));
        $this->assertSame('fail', collect($item['auto_checks'])->pluck('result', 'key')['near_duplicate']);
        $this->assertSame('reject', $item['auto_label']);
        $this->assertLessThanOrEqual(30, $item['auto_score']);
    }

    public function test_photos_reused_from_another_account_are_caught(): void
    {
        $first = $this->makeUser();
        $this->as($first)->postJson('/api/verification', $this->payload($first))->assertCreated();
        $second = $this->makeUser();
        $this->as($second)->postJson('/api/verification', $this->payload($second, [
            'license_number' => 'N02-24-111111',
            'front_media_id' => $this->uploadPattern($second, 'license_front', 1, 900, 600), // same picture as the first account's front
            'back_media_id' => $this->uploadPattern($second, 'license_back', 22),
            'selfie_media_id' => $this->uploadPattern($second, 'selfie', 33, 900, 1200),
        ]))->assertCreated();
        $license = DriverLicense::where('user_id', $second->id)->firstOrFail();
        $this->assertSame('fail', collect($license->auto_checks)->pluck('result', 'key')['reuse']);
        $this->assertSame('reject', $license->auto_label);
    }

    public function test_gibberish_address_is_rejected(): void
    {
        $u = $this->makeUser();
        $this->as($u)->postJson('/api/verification', $this->payload($u, ['address' => 'sfdasefasfsdfefsfsasefasd']))->assertStatus(422)->assertJsonValidationErrors('address');
        $this->assertNull(VerificationChecker::addressProblem('Lahug, Cebu City'));
        $this->assertNull(VerificationChecker::addressProblem('123 Colon Street, Cebu City'));
        $this->assertNotNull(VerificationChecker::addressProblem('asdf qwrt zxcv'));
        $this->assertNotNull(VerificationChecker::addressProblem('aaaaaaaa aaaa'));
    }

    public function test_uploads_must_be_real_images_of_usable_size(): void
    {
        $u = $this->makeUser();
        $fake = UploadedFile::fake()->createWithContent('license.jpg', 'this is not an image at all, just text pretending to be one');
        $this->as($u)->post('/api/media', ['file' => $fake, 'purpose' => 'license_front'], ['Accept' => 'application/json'])->assertStatus(422);
        $this->as($u)->post('/api/media', ['file' => $this->fakeImage('tiny.jpg', 300, 200), 'purpose' => 'license_front'], ['Accept' => 'application/json'])->assertStatus(422);
        $this->as($u)->post('/api/media', ['file' => $this->fakeImage('ok.jpg', 800, 600), 'purpose' => 'license_front'], ['Accept' => 'application/json'])->assertCreated();
    }

    public function test_image_hash_helper(): void
    {
        $this->assertTrue(ImageHash::available());
        $a = ImageHash::dhash($this->patternFile(7)->getContent());
        $b = ImageHash::dhash($this->patternFile(7, 600, 400)->getContent());
        $c = ImageHash::dhash($this->patternFile(8)->getContent());
        $this->assertLessThanOrEqual(ImageHash::NEAR_DUPLICATE_DISTANCE, ImageHash::distance($a, $b));
        $this->assertGreaterThan(ImageHash::NEAR_DUPLICATE_DISTANCE, ImageHash::distance($a, $c));
        $this->assertNull(ImageHash::dhash($this->fakeImage('blank.jpg', 600, 400)->getContent())); // blank frame has nothing to compare
    }

    // ----- Automatic decisions -----

    protected function freshPhotos(User $u, int $seed): array
    {
        return [
            'front_media_id' => $this->uploadPattern($u, 'license_front', $seed),
            'back_media_id' => $this->uploadPattern($u, 'license_back', $seed + 1),
            'selfie_media_id' => $this->uploadPattern($u, 'selfie', $seed + 2, 900, 1200),
        ];
    }

    protected function setCheck(array $checks, string $key, array $over): array
    {
        foreach ($checks['checks'] as &$c) {
            if ($c['key'] === $key) $c = array_merge($c, $over);
        }
        return $checks;
    }

    public function test_clean_submission_waits_for_review_when_auto_approve_is_off(): void
    {
        config(['verification.auto_approve' => false]);
        $u = $this->makeUser();
        $this->as($u)->postJson('/api/verification', $this->payload($u))->assertCreated()->assertJsonPath('status', 'pending')->assertJsonPath('decision', 'review');
        $license = DriverLicense::where('user_id', $u->id)->firstOrFail();
        $this->assertSame('pending', $license->status);
        $this->assertSame('review', $license->auto_decision);
        $log = VerificationDecision::where('driver_license_id', $license->id)->get();
        $this->assertCount(1, $log);
        $this->assertSame('review', $log[0]->outcome);
        $this->assertFalse($log[0]->settings['auto_approve']);
    }

    public function test_auto_approve_when_everything_passes_with_margin(): void
    {
        config(['verification.auto_approve' => true]);
        $u = $this->makeUser();
        $this->as($u)->postJson('/api/verification', $this->payload($u))->assertCreated()->assertJsonPath('status', 'verified')->assertJsonPath('decision', 'approve');
        $license = DriverLicense::where('user_id', $u->id)->firstOrFail();
        $this->assertSame('approved', $license->status);
        $this->assertSame('auto', $license->decision_source);
        $this->assertTrue($u->fresh()->isVerified());
        $log = VerificationDecision::where('driver_license_id', $license->id)->firstOrFail();
        $this->assertSame('approve', $log->outcome);
        $this->assertSame(0.82, $log->scores['face_similarity']);
        $this->assertNotEmpty($log->checks);

        $admin = $this->admin();
        $tab = $this->as($admin)->getJson('/api/admin/verifications?decision=auto_approved')->assertOk();
        $this->assertSame($license->id, $tab->json('data.0.id'));
        $this->as($admin)->getJson('/api/admin/verifications?decision=auto_rejected')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_scores_under_the_margin_or_any_warning_go_to_review(): void
    {
        config(['verification.auto_approve' => true]);
        $a = $this->makeUser();
        $lowMatch = $this->setCheck($this->goodClientChecks(), 'face_match', ['value' => 0.58]);
        $lowMatch['face_similarity'] = 0.58; // above the 0.5 minimum, below minimum + 0.15
        $this->as($a)->postJson('/api/verification', $this->payload($a, ['client_checks' => $lowMatch]))->assertCreated()->assertJsonPath('decision', 'review');
        $this->assertStringContainsString('Face match 58%', DriverLicense::where('user_id', $a->id)->firstOrFail()->auto_decision_reason);

        $b = $this->makeUser();
        $this->as($b)->postJson('/api/verification', $this->payload($b, ['restriction_codes' => ['A'], 'license_number' => 'N05-20-222222'] + $this->freshPhotos($b, 51)))->assertCreated()->assertJsonPath('decision', 'review'); // no car code = warning
        $this->assertSame('pending', $b->fresh()->verification_status);

        $c = $this->makeUser();
        $this->as($c)->postJson('/api/verification', $this->payload($c, ['client_checks' => null, 'license_number' => 'N06-20-333333'] + $this->freshPhotos($c, 61)))->assertCreated()->assertJsonPath('decision', 'review'); // nothing from the browser
    }

    public function test_critical_failure_auto_rejects_with_advice_and_allows_resubmission(): void
    {
        config(['verification.auto_approve' => false]); // auto-reject does not depend on the switch
        $u = $this->makeUser();
        $bad = $this->setCheck($this->goodClientChecks(), 'face_match', ['status' => 'pass', 'value' => 0.31]); // the server judges the number, not the device's verdict
        $bad['face_similarity'] = 0.31;
        $res = $this->as($u)->postJson('/api/verification', $this->payload($u, ['client_checks' => $bad]))->assertCreated()
            ->assertJsonPath('status', 'rejected')->assertJsonPath('decision', 'reject');
        $this->assertStringContainsString("didn't match the photo on the license", $res->json('message'));
        $this->assertStringContainsString('Retake', $res->json('license.rejection_reason'));
        $license = DriverLicense::where('user_id', $u->id)->firstOrFail();
        $this->assertSame('auto', $license->decision_source);
        $this->assertSame(['face_match'], VerificationDecision::where('driver_license_id', $license->id)->firstOrFail()->triggers);
        $this->assertDatabaseHas('user_notifications', ['user_id' => $u->id, 'kind' => 'danger']);

        $admin = $this->admin();
        $this->as($admin)->getJson('/api/admin/verifications?decision=auto_rejected')->assertOk()->assertJsonPath('data.0.id', $license->id);
        $this->as($admin)->getJson('/api/admin/verifications')->assertOk()->assertJsonCount(0, 'data'); // never reaches the review queue

        // The renter can try again with new photos.
        $this->as($u)->postJson('/api/verification', $this->payload($u, [
            'front_media_id' => $this->uploadPattern($u, 'license_front', 41),
            'back_media_id' => $this->uploadPattern($u, 'license_back', 42),
            'selfie_media_id' => $this->uploadPattern($u, 'selfie', 43, 900, 1200),
        ]))->assertCreated()->assertJsonPath('decision', 'review');
    }

    public function test_only_a_super_admin_can_override_an_automatic_decision(): void
    {
        config(['verification.auto_approve' => false]);
        $u = $this->makeUser();
        $bad = $this->setCheck($this->goodClientChecks(), 'selfie_antispoof', ['value' => 0.1]);
        $bad['antispoof'] = 0.1;
        $this->as($u)->postJson('/api/verification', $this->payload($u, ['client_checks' => $bad]))->assertCreated()->assertJsonPath('decision', 'reject');
        $license = DriverLicense::where('user_id', $u->id)->firstOrFail();

        $admin = $this->admin();
        $this->as($admin)->postJson("/api/admin/verifications/{$license->id}/override", ['decision' => 'approve', 'note' => 'Checked in person'])->assertForbidden();

        $admin->forceFill(['is_super_admin' => true])->save();
        $this->as($admin)->postJson("/api/admin/verifications/{$license->id}/override", ['decision' => 'approve'])->assertStatus(422); // note required
        $this->as($admin)->postJson("/api/admin/verifications/{$license->id}/override", ['decision' => 'reject', 'note' => 'Same'])->assertStatus(422); // already rejected
        $this->as($admin)->postJson("/api/admin/verifications/{$license->id}/override", ['decision' => 'approve', 'note' => 'Checked in person'])
            ->assertOk()->assertJsonPath('status', 'approved')->assertJsonPath('decision_source', 'admin')->assertJsonPath('override.note', 'Checked in person');
        $this->assertTrue($u->fresh()->isVerified());
        $events = VerificationDecision::where('driver_license_id', $license->id)->orderBy('id')->pluck('event')->all();
        $this->assertSame(['auto_decision', 'override'], $events);
        // Still listed under the auto-rejected tab (that is what the rules decided), flagged as overridden.
        $this->as($admin)->getJson('/api/admin/verifications?decision=auto_rejected')->assertJsonPath('data.0.override.by', $admin->name);
        $detail = $this->as($admin)->getJson("/api/admin/verifications/{$license->id}")->assertOk();
        $this->assertCount(2, $detail->json('decisions'));
    }

    public function test_review_submissions_cannot_be_overridden(): void
    {
        config(['verification.auto_approve' => false]);
        $u = $this->makeUser();
        $this->as($u)->postJson('/api/verification', $this->payload($u))->assertCreated();
        $license = DriverLicense::where('user_id', $u->id)->firstOrFail();
        $admin = $this->admin();
        $admin->forceFill(['is_super_admin' => true])->save();
        $this->as($admin)->postJson("/api/admin/verifications/{$license->id}/override", ['decision' => 'reject', 'note' => 'Nope'])->assertStatus(422);
    }

    public function test_host_application_listing_and_approval_flow(): void
    {
        $u = $this->makeUser();
        $this->as($u)->getJson('/api/host/dashboard')->assertStatus(403);
        $this->as($u)->postJson('/api/host-application', [
            'full_name' => 'Kim Navarro', 'phone' => '09451182290', 'city' => 'Cordova', 'vehicle_count' => 2, 'vehicle_types' => ['sedan'],
            'payout_method' => 'gcash', 'payout_account_name' => 'Kim Navarro', 'payout_account_number' => '09451182290', 'agree_terms' => true,
        ])->assertCreated()->assertJsonPath('application.status', 'pending');

        $admin = $this->admin();
        $appId = $this->as($admin)->getJson('/api/admin/host-applications')->json('data.0.id');
        $this->as($admin)->postJson("/api/admin/host-applications/{$appId}/approve")->assertOk();
        $this->assertSame('host', $u->fresh()->role);

        $hub = $this->hub();
        $vehicle = $this->as($u)->postJson('/api/host/vehicles', [
            'make' => 'Toyota', 'model' => 'Vios', 'year' => 2022, 'type' => 'sedan', 'transmission' => 'automatic', 'fuel' => 'gasoline', 'seats' => 5,
            'features' => ['Air conditioning'], 'daily_rate' => 1800,
        ])->assertCreated()->assertJsonPath('status', 'draft')->json();
        $this->as($u)->postJson("/api/host/vehicles/{$vehicle['id']}/submit")->assertStatus(422)->assertJsonValidationErrors('status');

        $photo = $this->as($u)->post('/api/media', ['file' => $this->fakeImage(), 'purpose' => 'vehicle_photo'], ['Accept' => 'application/json'])->json('id');
        $or = $this->as($u)->post('/api/media', ['file' => $this->fakeImage('or.jpg'), 'purpose' => 'vehicle_or'], ['Accept' => 'application/json'])->json('id');
        $cr = $this->as($u)->post('/api/media', ['file' => $this->fakeImage('cr.jpg'), 'purpose' => 'vehicle_cr'], ['Accept' => 'application/json'])->json('id');
        $this->as($u)->putJson("/api/host/vehicles/{$vehicle['id']}", [
            'make' => 'Toyota', 'model' => 'Vios', 'year' => 2022, 'type' => 'sedan', 'transmission' => 'automatic', 'fuel' => 'gasoline', 'seats' => 5,
            'daily_rate' => 1800, 'pickup_type' => 'hub', 'hub_id' => $hub->id, 'plate_number' => 'GAB 1234',
            'photo_ids' => [$photo], 'or_media_id' => $or, 'cr_media_id' => $cr,
        ])->assertOk()->assertJsonPath('city', 'Cebu City');
        $this->as($u)->postJson("/api/host/vehicles/{$vehicle['id']}/submit")->assertOk()->assertJsonPath('status', 'pending');
        $this->guest()->getJson('/api/vehicles')->assertJsonCount(0, 'data');

        $this->as($admin)->postJson("/api/admin/listings/{$vehicle['id']}/approve")->assertOk()->assertJsonPath('status', 'live');
        $list = $this->guest()->getJson('/api/vehicles')->assertJsonCount(1, 'data');
        $this->assertNotNull($list->json('data.0.photo'));
        $this->get($list->json('data.0.photo'))->assertOk()->assertHeader('Content-Type', 'image/jpeg');

        $this->as($u)->postJson("/api/host/vehicles/{$vehicle['id']}/pause")->assertOk()->assertJsonPath('status', 'paused');
        $this->guest()->getJson('/api/vehicles')->assertJsonCount(0, 'data');
        $this->as($u)->getJson('/api/host/dashboard')->assertOk()->assertJsonPath('setup.payout', true);
    }

    public function test_admin_suspends_user_and_settings_change_pricing(): void
    {
        $admin = $this->admin();
        $u = $this->makeUser();
        $this->as($admin)->postJson("/api/admin/users/{$u->id}/suspend", ['reason' => 'Fake documents'])->assertOk()->assertJsonPath('user.status', 'suspended');
        $this->guest()->postJson('/api/auth/login', ['login' => $u->username, 'password' => 'Password123'])->assertStatus(422);
        $this->as($admin)->postJson("/api/admin/users/{$u->id}/reinstate")->assertOk()->assertJsonPath('user.status', 'active');

        $this->as($admin)->putJson('/api/admin/settings', [
            'service_fee_rate' => 10, 'commission_rate' => 15, 'late_grace_minutes' => 60, 'cancellation_cutoff_hours' => 24,
            'late_fee_daily_cap' => 1.5, 'deposit_release_days' => 3,
        ])->assertOk();
        $v = $this->vehicle();
        $q = $this->guest()->postJson("/api/vehicles/{$v->id}/quote", ['pickup_at' => now()->addDays(3)->toIso8601String(), 'return_at' => now()->addDays(4)->toIso8601String()]);
        $this->assertSame(320, $q->json('service_fee'));
        $this->as($admin)->getJson('/api/admin/overview')->assertOk()->assertJsonStructure(['kpis', 'attention', 'months', 'recent']);
    }

    public function test_support_and_notifications(): void
    {
        $admin = $this->admin();
        $this->postJson('/api/support', ['name' => 'Ana', 'email' => 'ana@example.test', 'topic' => 'refund', 'message' => 'Where is my refund for my trip?'])->assertCreated();
        $t = $this->as($admin)->getJson('/api/admin/support')->assertOk()->json('data.0');
        $this->as($admin)->postJson("/api/admin/support/{$t['id']}/reply", ['reply' => 'It was sent today.'])->assertOk();
        $n = $this->as($admin)->getJson('/api/me/notifications')->assertOk()->json('data');
        $this->assertNotEmpty($n);
        $this->as($admin)->postJson('/api/me/notifications/read-all')->assertOk();
        $this->as($admin)->getJson('/api/me')->assertJsonPath('unread_notifications', 0);
    }
}
