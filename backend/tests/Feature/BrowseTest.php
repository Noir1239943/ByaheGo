<?php

namespace Tests\Feature;

use App\Models\Booking;
use Tests\TestCase;

class BrowseTest extends TestCase
{
    public function test_list_is_paginated_on_the_server(): void
    {
        $host = $this->host();
        for ($i = 0; $i < 12; $i++) $this->vehicle(['daily_rate' => 1000 + $i * 100], $host);
        $this->vehicle(['status' => 'pending'], $host); // not visible
        $res = $this->getJson('/api/vehicles?per_page=9')->assertOk();
        $this->assertCount(9, $res->json('data'));
        $res->assertJsonPath('meta.total', 12)->assertJsonPath('meta.last_page', 2);
        $this->assertCount(3, $this->getJson('/api/vehicles?per_page=9&page=2')->json('data'));
    }

    public function test_server_side_filters_and_sorting(): void
    {
        $host = $this->host();
        $this->vehicle(['type' => 'sedan', 'transmission' => 'manual', 'daily_rate' => 1500, 'seats' => 5, 'model' => 'Vios'], $host);
        $this->vehicle(['type' => 'suv', 'daily_rate' => 3200], $host);
        $this->vehicle(['type' => 'van', 'daily_rate' => 4500, 'seats' => 12, 'model' => 'Hiace'], $host);
        $this->assertCount(1, $this->getJson('/api/vehicles?type=sedan')->json('data'));
        $this->assertCount(2, $this->getJson('/api/vehicles?type=sedan,van')->json('data'));
        $this->assertCount(1, $this->getJson('/api/vehicles?transmission=manual')->json('data'));
        $this->assertCount(2, $this->getJson('/api/vehicles?price_max=3500')->json('data'));
        $this->assertCount(1, $this->getJson('/api/vehicles?seats=10')->json('data'));
        $this->assertCount(1, $this->getJson('/api/vehicles?q=hiace')->json('data'));
        $this->assertSame(1500, $this->getJson('/api/vehicles?sort=price_asc')->json('data.0.daily_rate'));
        $this->assertSame(4500, $this->getJson('/api/vehicles?sort=price_desc')->json('data.0.daily_rate'));
        $facets = $this->getJson('/api/vehicles?type=sedan')->json('facets.types');
        $this->assertEquals(1, $facets['suv']);
    }

    public function test_dates_filter_hides_booked_vehicles_and_nearest_sort(): void
    {
        $host = $this->host();
        $a = $this->vehicle([], $host);
        $far = $this->vehicle(['pickup_type' => 'own', 'hub_id' => null, 'lat' => 10.25, 'lng' => 123.95, 'city' => 'Cordova', 'pickup_address' => 'Poblacion'], $host);
        $renter = $this->verifiedRenter();
        $this->book($renter, $a)->assertCreated();
        $from = now()->addDays(5)->setTime(12, 0)->toIso8601String();
        $to = now()->addDays(6)->setTime(12, 0)->toIso8601String();
        $ids = collect($this->getJson('/api/vehicles?'.http_build_query(['pickup_at' => $from, 'return_at' => $to]))->json('data'))->pluck('id');
        $this->assertFalse($ids->contains($a->id));
        $this->assertTrue($ids->contains($far->id));

        $near = $this->getJson('/api/vehicles?sort=nearest&lat=10.2526&lng=123.9493')->assertOk();
        $this->assertSame($far->id, $near->json('data.0.id'));
        $this->assertNotNull($near->json('data.0.distance_km'));
    }

    public function test_live_map_reports_availability(): void
    {
        $host = $this->host();
        $a = $this->vehicle([], $host);
        $b = $this->vehicle(['model' => 'Vios'], $host);
        $renter = $this->verifiedRenter();
        $this->book($renter, $a)->assertCreated();
        Booking::first()->update(['status' => 'active', 'pickup_at' => now()->subHour(), 'return_at' => now()->addDay()]);
        $map = $this->guest()->getJson('/api/vehicles/map')->assertOk();
        $byId = collect($map->json('data'))->keyBy('id');
        $this->assertSame('on_trip', $byId[$a->id]['availability']);
        $this->assertSame('available', $byId[$b->id]['availability']);
        $this->assertNotNull($map->json('updated_at'));
    }

    public function test_detail_quote_and_recently_viewed(): void
    {
        $v = $this->vehicle();
        $u = $this->makeUser();
        $this->as($u)->getJson("/api/vehicles/{$v->id}")->assertOk()->assertJsonPath('name', 'Toyota Fortuner 2023')->assertJsonStructure(['policies', 'host', 'booked_ranges']);
        $this->as($u)->getJson('/api/me/recently-viewed')->assertOk()->assertJsonCount(1, 'data');
        $q = $this->postJson("/api/vehicles/{$v->id}/quote", [
            'pickup_at' => now()->addDays(3)->setTime(10, 0)->toIso8601String(),
            'return_at' => now()->addDays(5)->setTime(10, 0)->toIso8601String(),
        ])->assertOk();
        $this->assertSame(2, $q->json('days'));
        $this->assertSame(6400, $q->json('rental_subtotal'));
        $this->assertSame(480, $q->json('service_fee')); // 7.5%
        $this->assertSame(6880, $q->json('total'));
        $this->assertSame(11880, $q->json('due_now'));
        $this->postJson("/api/vehicles/{$v->id}/quote", ['pickup_at' => now()->addDays(3)->toIso8601String(), 'return_at' => now()->addDays(2)->toIso8601String()])->assertStatus(422);
    }

    public function test_favorites(): void
    {
        $v = $this->vehicle();
        $u = $this->makeUser();
        $this->as($u)->postJson("/api/me/favorites/{$v->id}")->assertOk();
        $this->as($u)->getJson('/api/me/favorites')->assertJsonCount(1, 'data');
        $this->as($u)->getJson('/api/vehicles')->assertJsonPath('data.0.is_favorite', true);
        $this->as($u)->deleteJson("/api/me/favorites/{$v->id}")->assertOk();
        $this->as($u)->getJson('/api/me/favorites')->assertJsonCount(0, 'data');
    }
}
