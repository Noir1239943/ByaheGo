<?php

namespace Tests\Feature;

use App\Models\Favorite;
use App\Models\Media;
use App\Models\User;
use App\Support\Settings;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * The database is far away (every query is a round trip, ~150 ms from Cebu to Neon in Singapore), so the number of queries
 * a request makes matters more than anything else. These tests keep it flat as the data grows and keep the caches honest.
 */
class PerformanceTest extends TestCase
{
    /** Runs `$call` and returns [response, number of queries it made]. */
    protected function counted(callable $call): array
    {
        DB::flushQueryLog();
        DB::enableQueryLog();
        $res = $call();
        $log = DB::getQueryLog();
        DB::disableQueryLog();
        return [$res, count($log), $log];
    }

    /** The first booking, then more of them: a list, a dashboard or an admin page must cost the same number of queries. */
    public function test_pages_do_not_make_more_queries_when_there_are_more_rows(): void
    {
        $this->assertTrue(Model::preventsLazyLoading(), 'Lazy loading must throw in development and tests, so a new N+1 is caught.');

        $host = $this->host();
        $renter = $this->verifiedRenter();
        $admin = $this->admin();
        $book = fn (int $n) => collect(range(1, $n))->each(fn ($i) => $this->book($renter, $this->vehicle(['plate_number' => "P{$i}".mt_rand(100, 999), 'model' => "Car{$i}"], $host))->assertCreated());

        $pages = [
            [$renter, '/api/bookings?tab=upcoming'],
            [$renter, '/api/me/billing'],
            [$host, '/api/host/bookings'],
            [$host, '/api/host/vehicles'],
            [$host, '/api/host/dashboard'],
            [$host, '/api/host/earnings'],
            [$admin, '/api/admin/bookings'],
            [$admin, '/api/admin/overview'],
            [$admin, '/api/admin/listings?status=all'],
            [$admin, '/api/admin/users'],
        ];

        $book(1);
        $few = [];
        foreach ($pages as [$who, $url]) {
            [$res, $few[$url]] = $this->counted(fn () => $this->as($who)->getJson($url));
            $res->assertOk();
        }
        $book(4);
        foreach ($pages as [$who, $url]) {
            [$res, $many] = $this->counted(fn () => $this->as($who)->getJson($url));
            $res->assertOk();
            $this->assertSame($few[$url], $many, "{$url} made {$few[$url]} queries with 1 booking but {$many} with 5: that is an N+1.");
            $this->assertLessThanOrEqual(14, $many, "{$url} makes too many queries ({$many}).");
        }
    }

    public function test_one_booking_costs_a_fixed_number_of_queries(): void
    {
        $renter = $this->verifiedRenter();
        $ref = $this->book($renter, $this->vehicle())->assertCreated()->json('reference');
        [$res, $n] = $this->counted(fn () => $this->as($renter)->getJson("/api/bookings/{$ref}"));
        $res->assertOk();
        $this->assertLessThanOrEqual(18, $n, "A booking page makes {$n} queries.");
    }

    public function test_browsing_is_cached_for_everyone_and_changes_show_at_once(): void
    {
        $host = $this->host();
        $a = $this->vehicle(['daily_rate' => 2000, 'model' => 'Vios'], $host);
        $this->vehicle(['daily_rate' => 3000, 'model' => 'Innova'], $host);

        [$first, $cold] = $this->counted(fn () => $this->guest()->getJson('/api/vehicles?sort=price_asc'));
        [$second, $warm] = $this->counted(fn () => $this->guest()->getJson('/api/vehicles?sort=price_asc'));
        $this->assertGreaterThan(3, $cold);
        $this->assertSame(0, $warm, 'The same search a moment later is answered from the cache.');
        $this->assertSame($first->json('data'), $second->json('data'));
        $this->assertSame(2000, $second->json('facets.price_range.min'));

        // Anything that changes a car clears the cache straight away: no stale price, no stale status.
        $a->update(['daily_rate' => 2500]);
        $this->assertSame(2500, $this->guest()->getJson('/api/vehicles?sort=price_asc')->json('data.0.daily_rate'));
        $a->update(['status' => 'paused']);
        $this->assertCount(1, $this->guest()->getJson('/api/vehicles')->json('data'));
        $this->assertSame(1, $this->guest()->getJson('/api/stats')->json('vehicles'));
    }

    /** The tests use an in-memory cache, but Render uses files, which refuse to rebuild objects: the cached search must be plain data. */
    public function test_cached_pages_survive_a_real_file_cache(): void
    {
        $dir = storage_path('framework/testing/perf-cache');
        config(['cache.default' => 'file', 'cache.stores.file.path' => $dir]);
        app('cache')->purge();
        $v = $this->vehicle();
        try {
            $cold = $this->guest()->getJson('/api/vehicles')->assertOk();
            $warm = $this->guest()->getJson('/api/vehicles')->assertOk();
            $this->assertSame($cold->json('data'), $warm->json('data'));
            $this->assertIsList($warm->json('data'));
            $this->assertSame($v->id, $warm->json('data.0.id'));
            $this->assertIsList($this->guest()->getJson('/api/vehicles/map')->assertOk()->json('data'));
            $this->assertIsList($this->guest()->getJson('/api/vehicles/map')->json('data'));
            $this->guest()->getJson("/api/vehicles/{$v->id}")->assertOk();
            $this->guest()->getJson("/api/vehicles/{$v->id}")->assertOk()->assertJsonPath('id', $v->id)->assertJsonCount(0, 'photos');
            $this->assertIsList($this->guest()->getJson('/api/hubs')->json('data'));
            $this->assertIsList($this->guest()->getJson('/api/hubs')->json('data'));
            $this->assertSame(1, $this->guest()->getJson('/api/stats')->json('vehicles'));
            $this->assertSame(1, $this->guest()->getJson('/api/stats')->json('vehicles'));
        } finally {
            \Illuminate\Support\Facades\File::deleteDirectory($dir);
        }
    }

    public function test_the_cached_search_still_shows_each_persons_own_favorites(): void
    {
        $v = $this->vehicle();
        $renter = $this->verifiedRenter();
        $this->guest()->getJson('/api/vehicles')->assertOk(); // warms the cache for everyone
        $this->assertFalse($this->guest()->getJson('/api/vehicles')->json('data.0.is_favorite'));
        Favorite::create(['user_id' => $renter->id, 'vehicle_id' => $v->id]);
        $this->assertTrue($this->as($renter)->getJson('/api/vehicles')->json('data.0.is_favorite'));
        $this->assertFalse($this->guest()->getJson('/api/vehicles')->json('data.0.is_favorite'));
    }

    public function test_typed_searches_and_dates_are_always_answered_fresh(): void
    {
        $this->vehicle(['model' => 'Vios']);
        [, $one] = $this->counted(fn () => $this->guest()->getJson('/api/vehicles?q=vios'));
        [, $two] = $this->counted(fn () => $this->guest()->getJson('/api/vehicles?q=vios'));
        $this->assertGreaterThan(0, $two);
        $this->assertSame($one, $two);
    }

    public function test_a_cars_page_is_cached_but_hidden_cars_stay_hidden(): void
    {
        $host = $this->host();
        $v = $this->vehicle([], $host);
        $renter = $this->verifiedRenter();

        $this->guest()->getJson("/api/vehicles/{$v->id}")->assertOk();
        [$cached, $n] = $this->counted(fn () => $this->guest()->getJson("/api/vehicles/{$v->id}"));
        $cached->assertOk()->assertJsonMissingPath('host_id_internal');
        $this->assertSame(0, $n);

        // Signed in: the favorite heart and "recently viewed" are the only extra work.
        Favorite::create(['user_id' => $renter->id, 'vehicle_id' => $v->id]);
        [$mine, $nMine] = $this->counted(fn () => $this->as($renter)->getJson("/api/vehicles/{$v->id}"));
        $mine->assertOk()->assertJsonPath('is_favorite', true);
        $this->assertLessThanOrEqual(7, $nMine);
        $this->assertDatabaseHas('recently_viewed', ['user_id' => $renter->id, 'vehicle_id' => $v->id]);
        $this->as($renter)->getJson("/api/vehicles/{$v->id}")->assertOk(); // the second view updates the row, it does not add one
        $this->assertSame(1, DB::table('recently_viewed')->where('user_id', $renter->id)->count());

        // The moment the car is paused it disappears for the public, but its host still sees it.
        $v->update(['status' => 'paused']);
        $this->guest()->getJson("/api/vehicles/{$v->id}")->assertNotFound();
        $this->as($renter)->getJson("/api/vehicles/{$v->id}")->assertNotFound();
        $this->as($host)->getJson("/api/vehicles/{$v->id}")->assertOk()->assertJsonMissingPath('host_id_internal');
        $this->as($this->admin())->getJson("/api/vehicles/{$v->id}")->assertOk();
        $this->guest()->getJson('/api/vehicles/999999')->assertNotFound();
    }

    public function test_a_blocked_host_disappears_from_the_cached_pages_at_once(): void
    {
        $host = $this->host();
        $v = $this->vehicle([], $host);
        $this->guest()->getJson("/api/vehicles/{$v->id}")->assertOk();
        $this->assertCount(1, $this->guest()->getJson('/api/vehicles')->json('data'));
        $host->update(['status' => 'revoked']);
        $this->guest()->getJson("/api/vehicles/{$v->id}")->assertNotFound();
        $this->assertCount(0, $this->guest()->getJson('/api/vehicles')->json('data'));
    }

    public function test_hubs_and_stats_are_cached_and_sent_with_cache_headers(): void
    {
        $this->vehicle();
        $this->guest()->getJson('/api/hubs')->assertOk();
        [$res, $n] = $this->counted(fn () => $this->guest()->getJson('/api/hubs'));
        $this->assertSame(0, $n);
        $this->assertStringContainsString('max-age=60', $res->headers->get('Cache-Control'));
        $stats = $this->guest()->getJson('/api/stats')->assertOk();
        $this->assertSame(1, $stats->json('vehicles'));
        [, $n] = $this->counted(fn () => $this->guest()->getJson('/api/stats'));
        $this->assertSame(0, $n);
    }

    public function test_settings_are_read_once_and_changes_apply_immediately(): void
    {
        Settings::flush();
        $newRequest = fn () => (new \ReflectionProperty(Settings::class, 'cache'))->setValue(null, null); // a new request starts with an empty in-memory copy, but the shared cache is warm
        [, $first] = $this->counted(fn () => Settings::get('service_fee_rate'));
        $newRequest();
        $this->assertGreaterThan(0, $first);
        [, $again] = $this->counted(fn () => Settings::get('service_fee_rate'));
        $this->assertSame(0, $again, 'Settings come from the cache, not the database, on every request after the first.');
        Settings::set(['service_fee_rate' => 11]);
        $this->assertSame(11.0, Settings::get('service_fee_rate'));
    }

    public function test_the_token_is_marked_used_at_most_every_five_minutes(): void
    {
        $user = $this->verifiedRenter();
        $headers = ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
        $writes = fn () => collect(DB::getQueryLog())->filter(fn ($q) => str_starts_with($q['query'], 'update "personal_access_tokens"'))->count();

        DB::enableQueryLog();
        $this->withHeaders($headers)->getJson('/api/me/favorite-ids')->assertOk();
        $this->assertSame(1, $writes(), 'The first use is recorded.');
        DB::flushQueryLog();
        $this->app['auth']->forgetGuards();
        $this->withHeaders($headers)->getJson('/api/me/favorite-ids')->assertOk();
        $this->assertSame(0, $writes(), 'A second use a moment later costs no write.');
        DB::flushQueryLog();
        $this->travel(6)->minutes();
        $this->app['auth']->forgetGuards();
        $this->withHeaders($headers)->getJson('/api/me/favorite-ids')->assertOk();
        $this->assertSame(1, $writes(), 'After five minutes it is recorded again.');
        DB::disableQueryLog();
    }

    public function test_photos_are_kept_by_the_browser_and_checked_with_an_etag(): void
    {
        $renter = $this->verifiedRenter();
        $id = $this->as($renter)->post('/api/media', ['file' => $this->fakeImage('car.jpg', 1200, 800), 'purpose' => 'vehicle_photo'], ['Accept' => 'application/json'])->assertCreated()->json('id');

        $res = $this->guest()->get("/api/media/{$id}?w=480")->assertOk();
        foreach (['public', 'max-age=31536000', 'immutable'] as $part) $this->assertStringContainsString($part, $res->headers->get('Cache-Control'));
        $etag = $res->headers->get('ETag');
        $this->assertSame('"'.Media::find($id)->sha1.'-w480"', $etag);
        $this->assertSame(480, getimagesizefromstring($res->getContent())[0]);

        // Asking again with the ETag costs a tiny query and no image data at all.
        [$not, , $log] = $this->counted(fn () => $this->guest()->get("/api/media/{$id}?w=480", ['If-None-Match' => $etag]));
        $not->assertStatus(304);
        $this->assertSame('', $not->getContent());
        $this->assertSame([], array_filter($log, fn ($q) => str_contains($q['query'], '"data"')), 'A 304 must not load the photo itself.');

        // Documents of people are never kept.
        $doc = $this->as($renter)->post('/api/media', ['file' => $this->fakeImage('id.jpg', 1000, 700), 'purpose' => 'license_front'], ['Accept' => 'application/json'])->json('id');
        $this->as($renter)->get("/api/media/{$doc}")->assertOk()->assertHeader('Cache-Control', 'no-store, private');
        $this->assertNull($this->as($renter)->get("/api/media/{$doc}")->headers->get('ETag'));
    }

    public function test_lists_point_to_resized_photos(): void
    {
        $v = $this->vehicle();
        $renter = $this->verifiedRenter();
        $id = $this->as($renter)->post('/api/media', ['file' => $this->fakeImage('car.jpg'), 'purpose' => 'vehicle_photo'], ['Accept' => 'application/json'])->json('id');
        $v->photos()->create(['media_id' => $id, 'position' => 1]);

        $this->assertStringEndsWith("/api/media/{$id}?w=640", $this->guest()->getJson('/api/vehicles')->json('data.0.photo'));
        $detail = $this->guest()->getJson("/api/vehicles/{$v->id}");
        $this->assertStringEndsWith("/api/media/{$id}", $detail->json('photos.0'));
        $this->assertStringEndsWith("/api/media/{$id}?w=960", $detail->json('photo_thumbs.0'));
    }

    public function test_the_sidebar_badges_have_their_own_light_endpoint(): void
    {
        $this->vehicle(['status' => 'pending']);
        $admin = $this->admin();
        $as = $this->as($admin);
        [$res, $n] = $this->counted(fn () => $as->getJson('/api/admin/attention'));
        $res->assertOk()->assertJsonPath('listings', 1)->assertJsonStructure(['verifications', 'listings', 'host_applications', 'disputes', 'payouts', 'support', 'flagged_bookings']);
        $this->assertLessThanOrEqual(4, $n, 'One query for the numbers, plus signing in (token, user, last-used).');
        $this->as($this->verifiedRenter())->getJson('/api/admin/attention')->assertForbidden();
    }

    public function test_the_overview_numbers_are_still_right(): void
    {
        $renter = $this->verifiedRenter();
        $this->book($renter, $this->vehicle())->assertCreated();
        $o = $this->as($this->admin())->getJson('/api/admin/overview')->assertOk();
        $this->assertSame(1, $o->json('kpis.bookings'));
        $this->assertGreaterThan(0, $o->json('kpis.gross_booking_value'));
        $this->assertSame(1, $o->json('kpis.live_vehicles'));
        $this->assertCount(12, $o->json('months'));
        $this->assertSame($o->json('kpis.gross_booking_value'), $o->json('months.11.amount'));
        $this->assertCount(1, $o->json('recent'));
        $this->assertSame(User::where('role', '!=', 'admin')->count(), $o->json('kpis.users'));
    }
}
