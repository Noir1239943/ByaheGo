<?php

namespace Tests\Feature;

use Tests\TestCase;

class SearchAndLocationTest extends TestCase
{
    protected function base(): array
    {
        return ['make' => 'Toyota', 'model' => 'Fortuner', 'year' => 2023, 'type' => 'suv', 'transmission' => 'automatic', 'fuel' => 'diesel', 'seats' => 7];
    }

    protected function ownVehicle(float $lat, float $lng, array $attrs = [], $host = null)
    {
        return $this->vehicle(array_merge([
            'pickup_type' => 'own', 'hub_id' => null, 'lat' => $lat, 'lng' => $lng, 'city' => 'Cebu City', 'area' => 'Lahug',
            'pickup_address' => 'Unit 5 Sampaguita Street, Lahug',
        ], $attrs), $host);
    }

    public function test_default_page_size_is_twelve_with_meta(): void
    {
        $host = $this->host();
        for ($i = 0; $i < 14; $i++) $this->vehicle(['daily_rate' => 1000 + $i * 50], $host);
        $res = $this->getJson('/api/vehicles')->assertOk()
            ->assertJsonPath('meta.per_page', 12)->assertJsonPath('meta.total', 14)->assertJsonPath('meta.current_page', 1)->assertJsonPath('meta.last_page', 2);
        $this->assertCount(12, $res->json('data'));
        $this->assertCount(2, $this->getJson('/api/vehicles?page=2')->json('data'));
    }

    public function test_bad_search_parameters_are_rejected(): void
    {
        $this->vehicle();
        $this->getJson('/api/vehicles?sort=cheapest')->assertStatus(422)->assertJsonValidationErrors('sort');
        $this->getJson('/api/vehicles?price_min=5000&price_max=1000')->assertStatus(422)->assertJsonValidationErrors('price_max');
        $this->getJson('/api/vehicles?type=spaceship')->assertStatus(422)->assertJsonValidationErrors('type');
        $this->getJson('/api/vehicles?fuel=water')->assertStatus(422)->assertJsonValidationErrors('fuel');
        $this->getJson('/api/vehicles?transmission=cvt')->assertStatus(422)->assertJsonValidationErrors('transmission');
        $this->getJson('/api/vehicles?per_page=500')->assertStatus(422)->assertJsonValidationErrors('per_page');
        $this->getJson('/api/vehicles?seats=abc')->assertStatus(422)->assertJsonValidationErrors('seats');
        $this->getJson('/api/vehicles?pickup_at='.urlencode(now()->addDay()->toIso8601String()))->assertStatus(422)->assertJsonValidationErrors('return_at');
        $this->getJson('/api/vehicles?'.http_build_query(['pickup_at' => now()->addDays(2)->toIso8601String(), 'return_at' => now()->addDay()->toIso8601String()]))->assertStatus(422)->assertJsonValidationErrors('return_at');
        $this->getJson('/api/vehicles?sort=nearest')->assertStatus(422)->assertJsonValidationErrors('lat');
        $this->getJson('/api/vehicles?radius=10')->assertStatus(422)->assertJsonValidationErrors('lat');
        $this->getJson('/api/vehicles?lat=95&lng=123')->assertStatus(422)->assertJsonValidationErrors('lat');
        $this->getJson('/api/vehicles/map?sort=nearest')->assertStatus(422);
    }

    public function test_search_text_is_treated_literally_and_never_matches_the_private_address(): void
    {
        $this->ownVehicle(10.3157, 123.8854);
        $this->assertCount(0, $this->getJson('/api/vehicles?q='.urlencode('%'))->json('data'));
        $this->assertCount(0, $this->getJson('/api/vehicles?q='.urlencode("' OR 1=1 --"))->json('data'));
        $this->assertCount(0, $this->getJson('/api/vehicles?location=Sampaguita')->json('data'));
        $this->assertCount(1, $this->getJson('/api/vehicles?location=Lahug')->json('data'));
        $this->assertCount(1, $this->getJson('/api/vehicles?q=FORTUNER')->json('data'));
    }

    public function test_radius_filter_and_nearest_sort(): void
    {
        $host = $this->host();
        $near = $this->ownVehicle(10.3300, 123.9100, ['model' => 'Near'], $host);   // ~3 km from the search point
        $mid = $this->ownVehicle(10.4000, 123.9600, ['model' => 'Mid'], $host);     // ~14 km
        $far = $this->ownVehicle(10.0200, 123.6300, ['model' => 'Far'], $host);     // ~50 km, outside any small radius
        $at = ['lat' => 10.3157, 'lng' => 123.8854];

        $within5 = collect($this->getJson('/api/vehicles?'.http_build_query($at + ['radius' => 5]))->assertOk()->json('data'))->pluck('id')->all();
        $this->assertSame([$near->id], $within5);

        $within20 = collect($this->getJson('/api/vehicles?'.http_build_query($at + ['radius' => 20]))->json('data'))->pluck('id')->all();
        $this->assertEqualsCanonicalizing([$near->id, $mid->id], $within20);

        $sorted = $this->getJson('/api/vehicles?'.http_build_query($at + ['sort' => 'nearest']))->assertOk();
        $this->assertSame([$near->id, $mid->id, $far->id], collect($sorted->json('data'))->pluck('id')->all());
        $this->assertLessThan(5, $sorted->json('data.0.distance_km'));
        $this->assertGreaterThan(40, $sorted->json('data.2.distance_km'));
        // Paging keeps the distance order and the same filters.
        $page2 = $this->getJson('/api/vehicles?'.http_build_query($at + ['sort' => 'nearest', 'per_page' => 1, 'page' => 2]))->json('data.0.id');
        $this->assertSame($mid->id, $page2);

        // The map uses the same radius.
        $this->assertCount(1, $this->getJson('/api/vehicles/map?'.http_build_query($at + ['radius' => 5]))->json('data'));
    }

    public function test_hub_cars_are_found_by_distance_too(): void
    {
        $hubCar = $this->vehicle();            // Ayala Center Cebu hub, 10.3181 / 123.9054
        $this->vehicle(['pickup_type' => 'own', 'hub_id' => null, 'lat' => 10.02, 'lng' => 123.63, 'city' => 'Argao', 'area' => 'Argao']);
        $ids = collect($this->getJson('/api/vehicles?lat=10.3157&lng=123.9&radius=5')->json('data'))->pluck('id')->all();
        $this->assertSame([$hubCar->id], $ids);
    }

    public function test_exact_pin_and_address_stay_private_until_booking(): void
    {
        $host = $this->host();
        $v = $this->ownVehicle(10.31574, 123.88543, [], $host);
        $renter = $this->verifiedRenter();

        $list = $this->getJson('/api/vehicles')->assertOk();
        $detail = $this->getJson("/api/vehicles/{$v->id}")->assertOk();
        $map = $this->getJson('/api/vehicles/map')->assertOk();
        foreach ([$list, $detail, $map] as $r) {
            $body = $r->getContent();
            $this->assertStringNotContainsString('Sampaguita', $body);
            $this->assertStringNotContainsString('10.31574', $body);
            $this->assertStringNotContainsString('123.88543', $body);
        }
        $this->assertEquals(10.32, $list->json('data.0.lat'));
        $this->assertEquals(123.89, $list->json('data.0.lng'));
        $this->assertSame('Lahug, Cebu City', $list->json('data.0.location_label'));
        $this->assertSame('own', $list->json('data.0.pickup_type'));
        $detail->assertJsonPath('pickup.approximate', true)->assertJsonPath('pickup.address', null);

        $ref = $this->book($renter, $v)->assertCreated()
            ->assertJsonPath('pickup_label', 'Unit 5 Sampaguita Street, Lahug, Cebu City')->json('reference');
        $this->assertEquals(10.31574, $this->as($renter)->getJson("/api/bookings/{$ref}")->json('pickup_lat'));
        $this->assertEquals(10.31574, $this->as($host)->getJson("/api/host/bookings/{$ref}")->json('pickup_lat'));
        $this->assertEquals(10.31574, $this->as($host)->getJson("/api/host/vehicles/{$v->id}")->assertOk()->json('pin_lat'));

        // Another renter still only gets the area, and a cancelled trip stops showing the exact spot.
        $other = $this->verifiedRenter();
        $this->assertStringNotContainsString('Sampaguita', $this->as($other)->getJson("/api/vehicles/{$v->id}")->getContent());
        $cancelled = $this->as($renter)->postJson("/api/bookings/{$ref}/cancel", ['reason' => 'Plans changed'])->assertOk();
        $this->assertStringNotContainsString('Sampaguita', (string) $cancelled->json('pickup_label'));
        $this->assertEquals(10.32, $cancelled->json('pickup_lat'));
    }

    public function test_own_location_listing_needs_a_pin_to_be_submitted(): void
    {
        $host = $this->host();
        $v = $this->ownVehicle(10.3157, 123.8854, ['status' => 'draft'], $host);
        $v->update(['lat' => null, 'lng' => null]);
        $msg = $this->as($host)->postJson("/api/host/vehicles/{$v->id}/submit")->assertStatus(422)->json('errors.status.0');
        $this->assertStringContainsString('pin for the pick-up spot', $msg);

        $this->as($host)->putJson("/api/host/vehicles/{$v->id}", $this->base() + ['lat' => 0, 'lng' => 0])->assertStatus(422)->assertJsonValidationErrors('lat');
        $this->as($host)->putJson("/api/host/vehicles/{$v->id}", $this->base() + ['pickup_type' => 'own', 'lat' => 10.3157, 'lng' => 123.8854, 'area' => 'Lahug'])->assertOk()
            ->assertJsonPath('pin_lat', 10.3157)->assertJsonPath('area', 'Lahug');
    }

    public function test_switching_a_hub_listing_to_own_location_drops_the_hub_pin(): void
    {
        $host = $this->host();
        $v = $this->vehicle(['status' => 'draft'], $host);
        $this->as($host)->putJson("/api/host/vehicles/{$v->id}", $this->base() + ['pickup_type' => 'own', 'pickup_address' => '12 Mango Ave', 'city' => 'Cebu City'])->assertOk()
            ->assertJsonPath('pin_lat', null);
    }

    public function test_blocked_dates_hide_a_car_for_those_days(): void
    {
        $host = $this->host();
        $v = $this->vehicle([], $host);
        $other = $this->vehicle([], $host);
        $start = now()->addDays(10)->toDateString();
        $end = now()->addDays(12)->toDateString();

        $this->as($host)->postJson("/api/host/vehicles/{$v->id}/blocked-dates", ['starts_on' => $start, 'ends_on' => $end, 'reason' => 'Service'])->assertCreated();
        $window = ['pickup_at' => now()->addDays(11)->setTime(9, 0)->toIso8601String(), 'return_at' => now()->addDays(11)->setTime(18, 0)->toIso8601String()];

        $ids = collect($this->guest()->getJson('/api/vehicles?'.http_build_query($window))->json('data'))->pluck('id')->all();
        $this->assertSame([$other->id], $ids);

        $map = collect($this->getJson('/api/vehicles/map?'.http_build_query($window))->json('data'))->keyBy('id');
        $this->assertSame('booked', $map[$v->id]['availability']);
        $this->assertSame('available', $map[$other->id]['availability']);

        $this->postJson("/api/vehicles/{$v->id}/quote", $window)->assertOk()->assertJsonPath('available', false);
        $renter = $this->verifiedRenter();
        $this->book($renter, $v, $window)->assertStatus(422)->assertJsonValidationErrors('pickup_at');
        $this->assertNotEmpty($this->getJson("/api/vehicles/{$v->id}")->json('booked_ranges'));

        // Free again once the host removes the block.
        $id = $this->as($host)->getJson("/api/host/vehicles/{$v->id}/blocked-dates")->assertOk()->json('data.0.id');
        $this->as($host)->deleteJson("/api/host/vehicles/{$v->id}/blocked-dates/{$id}")->assertOk();
        $this->assertCount(2, $this->guest()->getJson('/api/vehicles?'.http_build_query($window))->json('data'));
    }

    public function test_cannot_block_days_that_are_already_booked_or_belong_to_someone_else(): void
    {
        $host = $this->host();
        $v = $this->vehicle([], $host);
        $renter = $this->verifiedRenter();
        $this->book($renter, $v)->assertCreated(); // days +5 .. +7
        $this->as($host)->postJson("/api/host/vehicles/{$v->id}/blocked-dates", ['starts_on' => now()->addDays(6)->toDateString(), 'ends_on' => now()->addDays(8)->toDateString()])
            ->assertStatus(422)->assertJsonValidationErrors('starts_on');
        $this->as($host)->postJson("/api/host/vehicles/{$v->id}/blocked-dates", ['starts_on' => now()->subDay()->toDateString(), 'ends_on' => now()->addDay()->toDateString()])->assertStatus(422);
        $this->as($this->host())->postJson("/api/host/vehicles/{$v->id}/blocked-dates", ['starts_on' => now()->addDays(20)->toDateString(), 'ends_on' => now()->addDays(21)->toDateString()])->assertNotFound();
    }

    public function test_suspended_host_cars_are_not_available_on_the_map(): void
    {
        $host = $this->host();
        $v = $this->vehicle([], $host);
        $this->assertCount(1, $this->getJson('/api/vehicles/map')->json('data'));
        $host->update(['status' => 'suspended', 'suspended_until' => now()->addWeek()]);
        $this->assertCount(0, $this->getJson('/api/vehicles/map')->json('data'));
        $this->assertCount(0, $this->getJson('/api/vehicles')->json('data'));
    }
}
