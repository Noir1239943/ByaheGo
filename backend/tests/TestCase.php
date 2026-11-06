<?php

namespace Tests;

use App\Models\DriverLicense;
use App\Models\Hub;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\TripService;
use App\Support\Settings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Http\Client\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    /**
     * A stand-in for Xendit. `session_status` is what every session reports (ACTIVE = not paid yet); change it in a test
     * to play out an unpaid, expired or paid checkout. `autopay` makes book() finish the payment like the return page does.
     */
    protected array $xendit = ['session_status' => 'COMPLETED', 'autopay' => true, 'refund_status' => 'SUCCEEDED', 'fail_refunds' => false, 'fail_sessions' => false, 'n' => 0, 'sessions' => [], 'refunds' => [], 'calls' => []];

    protected function setUp(): void
    {
        parent::setUp();
        Settings::flush();
        config(['services.xendit.secret' => 'xnd_test_secret', 'services.xendit.callback_token' => 'cb-token', 'services.xendit.base_url' => 'https://api.xendit.co']);
        $this->fakeXendit();
    }

    protected function fakeXendit(): void
    {
        Http::fake([
            'api.xendit.co/sessions/*/cancel' => fn (Request $r) => Http::response(['status' => 'CANCELED']),
            'api.xendit.co/sessions/*' => function (Request $r) {
                $id = basename($r->url());
                $session = $this->xendit['sessions'][$id] ?? null;
                if (! $session) return Http::response(['message' => 'not found', 'error_code' => 'DATA_NOT_FOUND'], 404);
                $status = $this->xendit['session_status'];
                return Http::response($session + ['status' => $status] + ($status === 'COMPLETED' ? ['payment_id' => 'py-'.$id] : []));
            },
            'api.xendit.co/sessions' => function (Request $r) {
                $this->xendit['calls'][] = $r->data();
                if ($this->xendit['fail_sessions']) return Http::response(['message' => 'Channel(s) are not available', 'error_code' => 'INVALID_PAYMENT_CHANNEL'], 400);
                $id = 'ps-test-'.(++$this->xendit['n']);
                $this->xendit['sessions'][$id] = ['payment_session_id' => $id, 'payment_link_url' => 'https://pay.test/'.$id, 'expires_at' => now()->addMinutes(30)->toIso8601String()] + $r->data();
                return Http::response($this->xendit['sessions'][$id]);
            },
            'api.xendit.co/v3/refunds/*' => function (Request $r) {
                $id = basename($r->url());
                return Http::response(($this->xendit['refunds'][$id] ?? []) + ['refund_id' => $id, 'status' => $this->xendit['refund_status']]);
            },
            'api.xendit.co/v3/refunds' => function (Request $r) {
                $this->xendit['calls'][] = $r->data();
                if ($this->xendit['fail_refunds']) return Http::response(['message' => 'Refund is not allowed', 'error_code' => 'REFUND_NOT_ALLOWED'], 400);
                $id = 'rfd-test-'.(++$this->xendit['n']);
                $this->xendit['refunds'][$id] = $r->data() + ['refund_id' => $id];
                return Http::response($this->xendit['refunds'][$id] + ['status' => $this->xendit['refund_status']]);
            },
        ]);
    }

    /** Plays the renter coming back from Xendit's page after paying. */
    protected function payBooking(User $renter, string $reference): TestResponse
    {
        return $this->as($renter)->postJson("/api/bookings/{$reference}/verify-payment");
    }

    protected function makeUser(array $attrs = []): User
    {
        static $n = 0;
        $n++;
        return User::create(array_merge([
            'name' => 'Renter '.$n,
            'username' => 'renter'.$n,
            'email' => "renter{$n}@example.test",
            'phone' => '09171234567',
            'password' => 'Password123',
            'role' => 'renter',
            'status' => 'active',
            'verification_status' => 'unverified',
        ], $attrs));
    }

    protected function verifiedRenter(array $attrs = []): User
    {
        $u = $this->makeUser($attrs + ['verification_status' => 'verified']);
        DriverLicense::create([
            'user_id' => $u->id, 'license_type' => 'ph', 'license_number' => 'N01-23-'.str_pad((string) $u->id, 6, '0', STR_PAD_LEFT),
            'full_name' => $u->name, 'birthdate' => '1995-01-01', 'expiry_date' => now()->addYears(3)->toDateString(), 'status' => 'approved',
        ]);
        return $u;
    }

    protected function admin(): User
    {
        return $this->makeUser(['role' => 'admin', 'username' => 'Admin', 'name' => 'Site Admin', 'email' => 'admin@example.test']);
    }

    protected function host(): User
    {
        return $this->makeUser(['role' => 'host', 'verification_status' => 'verified', 'payout_method' => 'gcash', 'payout_account_name' => 'Host', 'payout_account_number' => '09170000000']);
    }

    protected function hub(): Hub
    {
        return Hub::firstOrCreate(['name' => 'Ayala Center Cebu Hub'], ['address' => 'Cebu Business Park', 'city' => 'Cebu City', 'lat' => 10.3181, 'lng' => 123.9054]);
    }

    protected function vehicle(array $attrs = [], ?User $host = null): Vehicle
    {
        $hub = $this->hub();
        return Vehicle::create(array_merge([
            'host_id' => ($host ?? $this->host())->id,
            'make' => 'Toyota', 'model' => 'Fortuner', 'year' => 2023, 'type' => 'suv', 'transmission' => 'automatic', 'fuel' => 'diesel',
            'seats' => 7, 'daily_rate' => 3200, 'security_deposit' => 5000, 'late_fee_per_hour' => 320, 'plate_number' => 'ABC 1234',
            'pickup_type' => 'hub', 'hub_id' => $hub->id, 'city' => $hub->city, 'lat' => $hub->lat, 'lng' => $hub->lng,
            'status' => 'live', 'with_driver_available' => true, 'driver_fee_per_day' => 1500,
        ], $attrs));
    }

    protected function as(User $user): static
    {
        $this->app['auth']->forgetGuards();
        return $this->withHeader('Authorization', 'Bearer '.$user->createToken('test')->plainTextToken);
    }

    protected function bookingPayload(Vehicle $v, array $over = []): array
    {
        return array_merge([
            'vehicle_id' => $v->id,
            'pickup_at' => now()->addDays(5)->setTime(10, 0)->toIso8601String(),
            'return_at' => now()->addDays(7)->setTime(10, 0)->toIso8601String(),
            'rental_type' => 'self',
            'protection_plan' => 'standard',
            'driver_name' => 'Vincent Laroco',
            'driver_phone' => '09171234567',
            'driver_email' => 'vincent@example.test',
            'payment_method' => 'gcash',
            'agree_terms' => true,
            'agreement_read_to_end' => true,
            'confirm_age' => true,
        ], $over);
    }

    protected function guest(): static
    {
        $this->app['auth']->forgetGuards();
        $this->defaultHeaders = [];
        return $this;
    }

    /** Books the way the website does: opens the agreement first, then signs the text it was shown with the verified name. */
    protected function book(User $renter, Vehicle $v, array $over = []): TestResponse
    {
        $payload = $this->bookingPayload($v, $over);
        if (! isset($payload['signature_name'])) {
            $preview = $this->as($renter)->postJson("/api/vehicles/{$v->id}/agreement", array_intersect_key($payload, array_flip(['pickup_at', 'return_at', 'rental_type', 'protection_plan'])));
            // When the preview itself fails (bad dates, ...) the booking call reports the same error before it checks the signature.
            $payload['signature_name'] = $preview->json('signer_name') ?? 'x';
            $payload['agreement_hash'] = $preview->json('hash') ?? str_repeat('0', 64);
        }
        $res = $this->as($renter)->postJson('/api/bookings', $payload);
        if ($res->getStatusCode() === 201 && $this->xendit['autopay']) {
            $paid = $this->payBooking($renter, $res->json('reference'))->assertOk();
            $paid->baseResponse->setStatusCode(201); // so the many tests that expect "created" keep reading naturally
            return $paid;
        }
        return $res;
    }

    /** The renter does the guided photos (all ten shots) and submits the check-in or check-out. */
    protected function inspect(User $user, string $ref, string $stage, array $over = []): TestResponse
    {
        foreach (array_keys(TripService::ANGLES) as $angle) {
            $this->as($user)->post("/api/bookings/{$ref}/inspection/{$stage}/photos", [
                'file' => $this->fakeImage($angle.'.jpg'), 'angle' => $angle, 'live' => true, 'device_time' => now()->toIso8601String(), 'lat' => 10.3157, 'lng' => 123.8854,
            ], ['Accept' => 'application/json'])->assertCreated();
        }
        return $this->as($user)->postJson("/api/bookings/{$ref}/inspection/{$stage}", $over + ['odometer' => 12000, 'fuel_level' => 100]);
    }

    protected function fakeImage(string $name = 'photo.jpg', int $w = 1200, int $h = 800): UploadedFile
    {
        return UploadedFile::fake()->image($name, $w, $h);
    }
}
