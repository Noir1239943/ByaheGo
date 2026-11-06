<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Favorite;
use App\Models\Hub;
use App\Models\RecentlyViewed;
use App\Models\Vehicle;
use App\Models\VehicleBlockedDate;
use App\Services\PricingService;
use App\Support\Present;
use App\Support\PublicCache;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class VehicleController extends Controller
{
    public const TYPES = ['sedan', 'hatchback', 'suv', 'mpv', 'van', 'pickup', 'motorcycle'];

    public const FUELS = ['gasoline', 'diesel', 'hybrid', 'electric'];
    public const PER_PAGE = 12;

    /** Every search parameter is validated, so a bad value is a clear 422 instead of being ignored. */
    protected function validateSearch(Request $request): void
    {
        $request->validate([
            'q' => ['nullable', 'string', 'max:60'],
            'location' => ['nullable', 'string', 'max:80'],
            'type' => ['nullable', 'string', 'max:80'],
            'transmission' => ['nullable', Rule::in(['automatic', 'manual'])],
            'fuel' => ['nullable', 'string', 'max:60'],
            'seats' => ['nullable', 'integer', 'between:1,20'],
            'price_min' => ['nullable', 'integer', 'min:0', 'max:1000000'],
            'price_max' => ['nullable', 'integer', 'min:0', 'max:1000000'],
            'rental_type' => ['nullable', Rule::in(['self', 'driver'])],
            'instant_book' => ['nullable', 'boolean'],
            'delivery' => ['nullable', 'boolean'],
            'pet_friendly' => ['nullable', 'boolean'],
            'hub_id' => ['nullable', 'integer', 'min:1'],
            'pickup_at' => ['nullable', 'date', 'required_with:return_at'],
            'return_at' => ['nullable', 'date', 'required_with:pickup_at', 'after:pickup_at'],
            'lat' => ['nullable', 'numeric', 'between:-90,90', 'required_with:lng,radius'],
            'lng' => ['nullable', 'numeric', 'between:-180,180', 'required_with:lat,radius'],
            'radius' => ['nullable', 'numeric', 'between:1,100'],
            'sort' => ['nullable', Rule::in(['recommended', 'price_asc', 'price_desc', 'rating', 'newest', 'nearest'])],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:24'],
        ], [
            'return_at.after' => 'The return time must be after the pick-up time.',
            'lat.required_with' => 'Share your location or choose an area to search by distance.',
            'lng.required_with' => 'Share your location or choose an area to search by distance.',
        ]);
        if ($request->filled('price_min') && $request->filled('price_max') && $request->integer('price_min') > $request->integer('price_max')) {
            throw ValidationException::withMessages(['price_max' => 'The highest price must not be below the lowest price.']);
        }
        foreach (explode(',', (string) $request->input('type')) as $t) {
            if ($t !== '' && ! in_array($t, self::TYPES, true)) throw ValidationException::withMessages(['type' => "Unknown vehicle type \"{$t}\"."]);
        }
        foreach (explode(',', (string) $request->input('fuel')) as $f) {
            if ($f !== '' && ! in_array($f, self::FUELS, true)) throw ValidationException::withMessages(['fuel' => "Unknown fuel type \"{$f}\"."]);
        }
        if ($request->input('sort') === 'nearest' && ! $request->filled('lat')) {
            throw ValidationException::withMessages(['lat' => 'Share your location or choose an area to sort by distance.']);
        }
    }

    /**
     * Plain browsing (filters, sort, page) is the same for everyone and worth keeping for a moment. A typed search, a place or
     * a date range is one person's question, so it is always answered fresh (and the cache can't be filled with one-off keys).
     */
    protected function shared(Request $request): bool
    {
        return ! $request->hasAny(['q', 'location', 'lat', 'lng', 'radius', 'pickup_at', 'return_at']);
    }

    protected function dates(Request $request): array
    {
        if (! $request->filled('pickup_at') || ! $request->filled('return_at')) return [null, null];
        return [Carbon::parse($request->input('pickup_at')), Carbon::parse($request->input('return_at'))];
    }

    protected function like(string $term): string
    {
        return '%'.addcslashes(mb_strtolower($term), '%_\\').'%';
    }

    /**
     * Distance in km² from a point to a vehicle's pick-up spot, written so it runs unchanged on Postgres (production)
     * and SQLite (tests). Own-location pins are rounded to ~1 km first, so searching can't be used to find an exact address.
     * At city scale this flat-earth formula is within 0.1% of Haversine; the km shown on the card uses Haversine in PHP.
     *
     * @return array{0: string, 1: array<int, float>}
     */
    protected function distanceSql(float $lat, float $lng): array
    {
        $kx = 111.320 * cos(deg2rad($lat));
        $latCol = "(CASE WHEN vehicles.pickup_type = 'own' OR vehicles.hub_id IS NULL THEN ROUND(vehicles.lat, ".Vehicle::PUBLIC_PIN_DECIMALS.') ELSE vehicles.lat END)';
        $lngCol = "(CASE WHEN vehicles.pickup_type = 'own' OR vehicles.hub_id IS NULL THEN ROUND(vehicles.lng, ".Vehicle::PUBLIC_PIN_DECIMALS.') ELSE vehicles.lng END)';
        $dy = "(({$latCol} - CAST(? AS DOUBLE PRECISION)) * 110.574)";
        $dx = "(({$lngCol} - CAST(? AS DOUBLE PRECISION)) * CAST(? AS DOUBLE PRECISION))";
        return ["({$dy} * {$dy} + {$dx} * {$dx})", [$lat, $lat, $lng, $kx, $lng, $kx]];
    }

    /** Filters shared by the list and map endpoints. All filtering happens in the database (server-side). */
    protected function filtered(Request $request, bool $applyType = true, bool $applyDates = true): Builder
    {
        $q = Vehicle::query()->live()->with(['hub', 'photos']);
        $esc = "ESCAPE '\\'";

        if ($term = trim((string) $request->input('q'))) {
            $like = $this->like($term);
            $q->where(function ($w) use ($like, $esc) {
                $w->whereRaw("LOWER(vehicles.make) LIKE ? {$esc}", [$like])
                    ->orWhereRaw("LOWER(vehicles.model) LIKE ? {$esc}", [$like])
                    ->orWhereRaw("LOWER(vehicles.make || ' ' || vehicles.model) LIKE ? {$esc}", [$like])
                    ->orWhereRaw("LOWER(vehicles.city) LIKE ? {$esc}", [$like])
                    ->orWhereRaw("LOWER(vehicles.area) LIKE ? {$esc}", [$like])
                    ->orWhereHas('hub', fn ($h) => $h->whereRaw("LOWER(city) LIKE ? {$esc}", [$like])->orWhereRaw("LOWER(name) LIKE ? {$esc}", [$like]));
            });
        }
        // Text place filter. Only city, area and hub are searched, never the private street address.
        if ($location = trim((string) $request->input('location'))) {
            $like = $this->like(trim(explode(',', $location)[0]));
            $q->where(fn ($w) => $w->whereRaw("LOWER(vehicles.city) LIKE ? {$esc}", [$like])->orWhereRaw("LOWER(vehicles.area) LIKE ? {$esc}", [$like])
                ->orWhereHas('hub', fn ($h) => $h->whereRaw("LOWER(city) LIKE ? {$esc}", [$like])->orWhereRaw("LOWER(name) LIKE ? {$esc}", [$like])->orWhereRaw("LOWER(address) LIKE ? {$esc}", [$like])));
        }
        if ($applyType && $request->filled('type')) {
            $types = array_intersect(explode(',', (string) $request->input('type')), self::TYPES);
            if ($types) $q->whereIn('vehicles.type', $types);
        }
        if ($request->filled('transmission')) $q->where('vehicles.transmission', $request->input('transmission'));
        if ($request->filled('fuel')) $q->whereIn('vehicles.fuel', explode(',', (string) $request->input('fuel')));
        if ($request->integer('seats') > 0) $q->where('vehicles.seats', '>=', $request->integer('seats'));
        if ($request->integer('price_min') > 0) $q->where('vehicles.daily_rate', '>=', $request->integer('price_min'));
        if ($request->integer('price_max') > 0) $q->where('vehicles.daily_rate', '<=', $request->integer('price_max'));
        if ($request->input('rental_type') === 'driver') $q->where('vehicles.with_driver_available', true);
        if ($request->boolean('instant_book')) $q->where('vehicles.instant_book', true);
        if ($request->boolean('delivery')) $q->where('vehicles.delivery_available', true);
        if ($request->boolean('pet_friendly')) $q->where('vehicles.pet_friendly', true);
        if ($request->integer('hub_id') > 0) $q->where('vehicles.hub_id', $request->integer('hub_id'));

        if ($request->filled('lat') && $request->filled('lng') && $request->filled('radius')) {
            $lat = (float) $request->input('lat');
            $lng = (float) $request->input('lng');
            $r = (float) $request->input('radius');
            // 1) Bounding box on the indexed lat/lng columns (the 0.01 degree margin covers the rounding of private pins).
            $dLat = $r / 110.574 + 0.01;
            $dLng = $r / max(111.320 * cos(deg2rad($lat)), 1) + 0.01;
            $q->whereBetween('vehicles.lat', [$lat - $dLat, $lat + $dLat])->whereBetween('vehicles.lng', [$lng - $dLng, $lng + $dLng]);
            // 2) Exact radius on what is left.
            [$sql, $bindings] = $this->distanceSql($lat, $lng);
            $q->whereRaw("{$sql} <= ?", [...$bindings, $r * $r]);
        }

        [$from, $to] = $this->dates($request);
        if ($applyDates && $from && $to) $q->freeBetween($from, $to);
        return $q;
    }

    protected function distanceKm(float $lat1, float $lng1, ?float $lat2, ?float $lng2): ?float
    {
        if ($lat2 === null || $lng2 === null) return null;
        $r = 6371;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
        return round($r * 2 * atan2(sqrt($a), sqrt(1 - $a)), 1);
    }

    public function index(Request $request)
    {
        $this->validateSearch($request);
        // The same search is shown to everyone, so it is kept for a short while (and dropped the moment a car, booking
        // or review changes). Only the little heart on each card is per person, and that is added after.
        $result = $this->shared($request) ? PublicCache::remember('search', $request->query(), 30, fn () => $this->search($request)) : $this->search($request);
        if ($u = Auth::guard('sanctum')->user()) {
            $favIds = Favorite::where('user_id', $u->id)->pluck('vehicle_id')->all();
            $result['data'] = collect($result['data'])->map(fn ($card) => ['is_favorite' => in_array($card['id'], $favIds, true)] + $card)->values()->all();
        }
        return response()->json($result);
    }

    protected function search(Request $request): array
    {
        $q = $this->filtered($request);
        $lat = $request->filled('lat') ? (float) $request->input('lat') : null;
        $lng = $request->filled('lng') ? (float) $request->input('lng') : null;

        switch ($request->input('sort', 'recommended')) {
            case 'price_asc': $q->orderBy('vehicles.daily_rate')->orderBy('vehicles.id'); break;
            case 'price_desc': $q->orderByDesc('vehicles.daily_rate')->orderBy('vehicles.id'); break;
            case 'rating': $q->orderByDesc('vehicles.rating_avg')->orderByDesc('vehicles.rating_count')->orderBy('vehicles.id'); break;
            case 'newest': $q->orderByDesc('vehicles.approved_at')->orderByDesc('vehicles.id'); break;
            case 'nearest':
                [$sql, $bindings] = $this->distanceSql($lat, $lng);
                $q->orderByRaw("{$sql} asc", $bindings)->orderBy('vehicles.id');
                break;
            default: $q->orderByDesc('vehicles.rating_avg')->orderByDesc('vehicles.trips_count')->orderBy('vehicles.id');
        }

        $page = $q->paginate($request->integer('per_page', self::PER_PAGE) ?: self::PER_PAGE);

        $result = Present::paginated($page, function (Vehicle $v) use ($lat, $lng) {
            $card = Present::vehicleCard($v, ['is_favorite' => false]);
            if ($lat !== null && $lng !== null) $card['distance_km'] = $this->distanceKm($lat, $lng, $card['lat'], $card['lng']);
            return $card;
        });

        // Facet counts for the vehicle-type filter (all other filters applied).
        $range = Vehicle::live()->selectRaw('MIN(daily_rate) as lo, MAX(daily_rate) as hi')->first();
        $result['facets'] = [
            'types' => $this->filtered($request, false)->reorder()->selectRaw('vehicles.type, COUNT(*) as total')->groupBy('vehicles.type')->pluck('total', 'type'),
            'price_range' => ['min' => (int) $range->lo, 'max' => (int) $range->hi],
        ];
        return $result;
    }

    /**
     * Live availability map: every matching vehicle with its status for the chosen dates and right now.
     * "Available" = live listing, host not suspended, and neither booked nor blocked by the host for the dates.
     */
    public function map(Request $request)
    {
        $this->validateSearch($request);
        // Kept for a few seconds: the map is polled, and "available right now" only needs to be that fresh.
        return response()->json($this->shared($request) ? PublicCache::remember('map', $request->query(), 15, fn () => $this->mapData($request)) : $this->mapData($request));
    }

    protected function mapData(Request $request): array
    {
        [$from, $to] = $this->dates($request);
        $lat = $request->filled('lat') ? (float) $request->input('lat') : null;
        $lng = $request->filled('lng') ? (float) $request->input('lng') : null;
        $vehicles = $this->filtered($request, true, false)->limit(300)->get();
        $ids = $vehicles->pluck('id');
        $now = now();
        $hasDates = $from && $to;
        $windowFrom = $hasDates ? $from : $now;
        $windowTo = $hasDates ? $to : $now->copy()->addSecond();

        $onTrip = Booking::whereIn('vehicle_id', $ids)->where('status', 'active')->pluck('vehicle_id')->flip();
        $unavailable = Booking::whereIn('vehicle_id', $ids)->blocking()->where('pickup_at', '<', $windowTo)->where('return_at', '>', $windowFrom)->pluck('vehicle_id')
            ->merge(VehicleBlockedDate::whereIn('vehicle_id', $ids)->where('starts_on', '<=', $windowTo->toDateString())->where('ends_on', '>=', $windowFrom->toDateString())->pluck('vehicle_id'))->flip();

        $data = $vehicles->map(function (Vehicle $v) use ($onTrip, $unavailable, $hasDates, $lat, $lng) {
            if (isset($unavailable[$v->id])) $status = $hasDates || ! isset($onTrip[$v->id]) ? 'booked' : 'on_trip';
            else $status = ! $hasDates && isset($onTrip[$v->id]) ? 'on_trip' : 'available';
            $card = Present::vehicleCard($v, ['availability' => $status, 'on_trip_now' => isset($onTrip[$v->id])]);
            if ($lat !== null && $lng !== null) $card['distance_km'] = $this->distanceKm($lat, $lng, $card['lat'], $card['lng']);
            return $card;
        })->values();

        return [
            'data' => $data,
            'counts' => [
                'available' => $data->where('availability', 'available')->count(),
                'booked' => $data->where('availability', 'booked')->count(),
                'on_trip' => $data->where('availability', 'on_trip')->count(),
            ],
            'updated_at' => $now->toIso8601String(),
        ];
    }

    public function show(int $id)
    {
        $user = Auth::guard('sanctum')->user();
        // What a visitor sees of a live car is the same for everyone, so it is kept for a moment and dropped the moment
        // the car, a booking or a review changes. A car that is not public is only built (fresh) for its host or an admin.
        $public = PublicCache::remember('vehicle', ['id' => $id], 30, fn () => $this->detail($id, false));
        $detail = $public ?? ($user ? $this->detail($id, true) : null);
        if ($detail === null || ($public === null && ! ($user->isAdmin() || $user->id === $detail['host_id_internal']))) abort(404, 'This vehicle is no longer available.');
        unset($detail['host_id_internal']);

        if ($user) {
            // One statement: refresh the "viewed" time, or add the row the first time.
            if (! RecentlyViewed::where(['user_id' => $user->id, 'vehicle_id' => $id])->update(['viewed_at' => now()])) {
                RecentlyViewed::create(['user_id' => $user->id, 'vehicle_id' => $id, 'viewed_at' => now()]);
            }
        }
        return response()->json($detail + ['is_favorite' => $user ? Favorite::where(['user_id' => $user->id, 'vehicle_id' => $id])->exists() : false]);
    }

    /** The whole page of a car. With $force false it returns null unless the car is public (live, host not blocked). */
    protected function detail(int $id, bool $force): ?array
    {
        $vehicle = Vehicle::with(['hub', 'photos', 'host' => fn ($h) => $h->withCount([
            'vehicles as live_vehicles' => fn ($v) => $v->where('status', 'live'),
            'hostBookings as completed_trips' => fn ($b) => $b->where('status', 'completed'),
        ])])->findOrFail($id);
        if (! $force && ! ($vehicle->status === 'live' && ! $vehicle->host?->isBlocked())) return null;

        $reviews = $vehicle->reviews()->with('renter:id,name')->latest()->limit(4)->get();
        $breakdown = $vehicle->reviews()->selectRaw('rating, COUNT(*) as total')->groupBy('rating')->pluck('total', 'rating');

        return Present::vehicleDetail($vehicle) + [
            'host_id_internal' => $vehicle->host_id,
            'reviews' => $reviews->map(fn ($r) => Present::review($r))->values(),
            'rating_breakdown' => collect([5, 4, 3, 2, 1])->mapWithKeys(fn ($s) => [$s => (int) ($breakdown[$s] ?? 0)]),
            'booked_ranges' => $vehicle->bookings()->blocking()->where('return_at', '>', now())->orderBy('pickup_at')
                ->get(['pickup_at', 'return_at'])->map(fn ($b) => ['from' => $b->pickup_at->toIso8601String(), 'to' => $b->return_at->toIso8601String()])
                ->concat($vehicle->blockedDates()->where('ends_on', '>=', today())->get()->map(fn ($d) => ['from' => $d->starts_on->startOfDay()->toIso8601String(), 'to' => $d->ends_on->endOfDay()->toIso8601String()]))
                ->sortBy('from')->values(),
            'similar' => Vehicle::live()->with(['hub', 'photos'])->where('type', $vehicle->type)->where('id', '!=', $vehicle->id)
                ->orderByDesc('rating_avg')->limit(3)->get()->map(fn ($v) => Present::vehicleCard($v))->values(),
        ];
    }

    public function reviews(Request $request, int $id)
    {
        $vehicle = Vehicle::findOrFail($id);
        $page = $vehicle->reviews()->with('renter')->latest()->paginate(6);
        return response()->json(Present::paginated($page, fn ($r) => Present::review($r)));
    }

    public function quote(Request $request, int $id, PricingService $pricing)
    {
        $vehicle = Vehicle::with('hub')->findOrFail($id);
        $data = $request->validate([
            'pickup_at' => ['required', 'date'],
            'return_at' => ['required', 'date'],
            'rental_type' => ['nullable', Rule::in(['self', 'driver'])],
            'protection_plan' => ['nullable', Rule::in(['standard', 'plus', 'premium'])],
        ]);
        $pickup = Carbon::parse($data['pickup_at']);
        $return = Carbon::parse($data['return_at']);
        $quote = $pricing->quote($vehicle, $pickup, $return, $data['rental_type'] ?? 'self', $data['protection_plan'] ?? 'standard');
        $available = $vehicle->isFreeBetween($pickup, $return);
        return response()->json($quote + ['available' => $available]);
    }

    public function hubs()
    {
        $data = PublicCache::remember('hubs', [], 600, fn () => Hub::orderBy('name')->get());
        return response()->json(['data' => $data])->header('Cache-Control', 'public, max-age=60');
    }

    public function stats()
    {
        $stats = PublicCache::remember('stats', [], 60, function () {
            // One query for all five numbers.
            $row = Vehicle::live()->selectRaw("COUNT(*) as vehicles, COUNT(DISTINCT host_id) as hosts, COUNT(DISTINCT city) as cities,
                AVG(CASE WHEN rating_count > 0 THEN rating_avg END) as avg_rating, MIN(daily_rate) as min_rate")->first();
            return [
                'vehicles' => (int) $row->vehicles,
                'hosts' => (int) $row->hosts,
                'cities' => (int) $row->cities,
                'avg_rating' => round((float) $row->avg_rating, 1),
                'min_rate' => (int) $row->min_rate,
            ];
        });
        return response()->json($stats)->header('Cache-Control', 'public, max-age=60');
    }
}
