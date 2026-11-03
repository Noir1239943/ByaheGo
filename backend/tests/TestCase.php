<?php

namespace Tests;

use App\Models\DriverLicense;
use App\Models\Hub;
use App\Models\User;
use App\Models\Vehicle;
use App\Support\Settings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Http\UploadedFile;
use Illuminate\Testing\TestResponse;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Settings::flush();
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
            'wallet_number' => '09171234567',
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
        return $this->as($renter)->postJson('/api/bookings', $payload);
    }

    protected function fakeImage(string $name = 'photo.jpg', int $w = 1200, int $h = 800): UploadedFile
    {
        return UploadedFile::fake()->image($name, $w, $h);
    }
}
