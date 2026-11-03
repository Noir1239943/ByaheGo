<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Favorite;
use App\Models\Hub;
use App\Models\RecentlyViewed;
use App\Models\Vehicle;
use App\Services\PricingService;
use App\Support\Present;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class VehicleController extends Controller
{
    public const TYPES = ['sedan', 'hatchback', 'suv', 'mpv', 'van', 'pickup', 'motorcycle'];

    protected function dates(Request $request): array
    {
        try {
            $from = $request->filled('pickup_at') ? Carbon::parse($request->input('pickup_at')) : null;
            $to = $request->filled('return_at') ? Carbon::parse($request->input('return_at')) : null;
        } catch (\Throwable) {
            return [null, null];
        }
        if ($from && $to && $to->lessThanOrEqualTo($from)) return [null, null];
        return [$from, $to];
    }

    /** Filters shared by the list and map endpoints. All filtering happens in the database (server-side). */
    protected function filtered(Request $request, bool $applyType = true, bool $applyDates = true): Builder
    {
        $q = Vehicle::query()->live()->with(['hub', 'photos']);

        if ($term = trim((string) $request->input('q'))) {
            $like = '%'.mb_strtolower($term).'%';
            $q->where(function ($w) use ($like) {
                $w->whereRaw('LOWER(make) LIKE ?', [$like])
                    ->orWhereRaw('LOWER(model) LIKE ?', [$like])
                    ->orWhereRaw("LOWER(make || ' ' || model) LIKE ?", [$like])
                    ->orWhereRaw('LOWER(vehicles.city) LIKE ?', [$like])
                    ->orWhereHas('hub', fn ($h) => $h->whereRaw('LOWER(city) LIKE ?', [$like])->orWhereRaw('LOWER(name) LIKE ?', [$like]));
            });
        }
        if ($location = trim((string) $request->input('location'))) {
            $like = '%'.mb_strtolower(explode(',', $location)[0]).'%';
            $q->where(fn ($w) => $w->whereRaw('LOWER(vehicles.city) LIKE ?', [$like])->orWhereRaw('LOWER(vehicles.pickup_address) LIKE ?', [$like])
                ->orWhereHas('hub', fn ($h) => $h->whereRaw('LOWER(city) LIKE ?', [$like])->orWhereRaw('LOWER(name) LIKE ?', [$like])->orWhereRaw('LOWER(address) LIKE ?', [$like])));
        }
        if ($applyType && $request->filled('type')) {
            $types = array_intersect(explode(',', (string) $request->input('type')), self::TYPES);
            if ($types) $q->whereIn('type', $types);
        }
        if (in_array($request->input('transmission'), ['automatic', 'manual'], true)) $q->where('transmission', $request->input('transmission'));
        if ($request->filled('fuel')) $q->whereIn('fuel', explode(',', (string) $request->input('fuel')));
        if ($request->integer('seats') > 0) $q->where('seats', '>=', $request->integer('seats'));
        if ($request->integer('price_min') > 0) $q->where('daily_rate', '>=', $request->integer('price_min'));
        if ($request->integer('price_max') > 0) $q->where('daily_rate', '<=', $request->integer('price_max'));
        if ($request->input('rental_type') === 'driver') $q->where('with_driver_available', true);
        if ($request->boolean('instant_book')) $q->where('instant_book', true);
        if ($request->boolean('delivery')) $q->where('delivery_available', true);
        if ($request->boolean('pet_friendly')) $q->where('pet_friendly', true);
        if ($request->integer('hub_id') > 0) $q->where('hub_id', $request->integer('hub_id'));

        [$from, $to] = $this->dates($request);
        if ($applyDates && $from && $to) {
            $q->whereDoesntHave('bookings', fn ($b) => $b->blocking()->where('pickup_at', '<', $to)->where('return_at', '>', $from));
        }
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
        $request->validate([
            'sort' => ['nullable', Rule::in(['recommended', 'price_asc', 'price_desc', 'rating', 'newest', 'nearest'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:24'],
            'lat' => ['nullable', 'numeric', 'between:-90,90'],
            'lng' => ['nullable', 'numeric', 'between:-180,180'],
        ]);
        $q = $this->filtered($request);
        $lat = $request->filled('lat') ? (float) $request->input('lat') : null;
        $lng = $request->filled('lng') ? (float) $request->input('lng') : null;

        switch ($request->input('sort', 'recommended')) {
            case 'price_asc': $q->orderBy('daily_rate')->orderBy('id'); break;
            case 'price_desc': $q->orderByDesc('daily_rate')->orderBy('id'); break;
            case 'rating': $q->orderByDesc('rating_avg')->orderByDesc('rating_count'); break;
            case 'newest': $q->orderByDesc('approved_at')->orderByDesc('id'); break;
            case 'nearest':
                if ($lat !== null && $lng !== null) {
                    // Equirectangular approximation – accurate enough to rank pick-up spots within a city.
                    $k = cos(deg2rad($lat)) ** 2;
                    $q->leftJoin('hubs as h', 'h.id', '=', 'vehicles.hub_id')->select('vehicles.*')
                        ->orderByRaw('((COALESCE(h.lat, vehicles.lat) - ?) * (COALESCE(h.lat, vehicles.lat) - ?) + (COALESCE(h.lng, vehicles.lng) - ?) * (COALESCE(h.lng, vehicles.lng) - ?) * ?) asc', [$lat, $lat, $lng, $lng, $k]);
                    break;
                }
                // fall through
            default: $q->orderByDesc('rating_avg')->orderByDesc('trips_count')->orderBy('vehicles.id');
        }

        $page = $q->paginate($request->integer('per_page', 9) ?: 9);
        $favIds = ($u = Auth::guard('sanctum')->user()) ? Favorite::where('user_id', $u->id)->pluck('vehicle_id')->all() : [];

        $result = Present::paginated($page, function (Vehicle $v) use ($lat, $lng, $favIds) {
            $card = Present::vehicleCard($v, ['is_favorite' => in_array($v->id, $favIds, true)]);
            if ($lat !== null && $lng !== null) $card['distance_km'] = $this->distanceKm($lat, $lng, $card['lat'], $card['lng']);
            return $card;
        });

        // Facet counts for the vehicle-type filter (all other filters applied).
        $result['facets'] = [
            'types' => $this->filtered($request, false)->reorder()->selectRaw('type, COUNT(*) as total')->groupBy('type')->pluck('total', 'type'),
            'price_range' => ['min' => (int) Vehicle::live()->min('daily_rate'), 'max' => (int) Vehicle::live()->max('daily_rate')],
        ];
        return response()->json($result);
    }

    /** Live availability map: every matching vehicle with its status for the chosen dates and right now. */
    public function map(Request $request)
    {
        [$from, $to] = $this->dates($request);
        $vehicles = $this->filtered($request, true, false)->limit(300)->get();
        $ids = $vehicles->pluck('id');
        $now = now();
        $onTrip = Booking::whereIn('vehicle_id', $ids)->where('status', 'active')->pluck('vehicle_id')->flip();
        $bookedForDates = $from && $to
            ? Booking::whereIn('vehicle_id', $ids)->blocking()->where('pickup_at', '<', $to)->where('return_at', '>', $from)->pluck('vehicle_id')->flip()
            : Booking::whereIn('vehicle_id', $ids)->blocking()->where('pickup_at', '<=', $now)->where('return_at', '>', $now)->pluck('vehicle_id')->flip();

        $hasDates = $from && $to;
        $data = $vehicles->map(function (Vehicle $v) use ($onTrip, $bookedForDates, $hasDates) {
            if ($hasDates) {
                $status = isset($bookedForDates[$v->id]) ? 'booked' : 'available';
            } else {
                $status = isset($onTrip[$v->id]) ? 'on_trip' : (isset($bookedForDates[$v->id]) ? 'booked' : 'available');
            }
            return Present::vehicleCard($v, ['availability' => $status, 'on_trip_now' => isset($onTrip[$v->id])]);
        })->values();

        return response()->json([
            'data' => $data,
            'counts' => [
                'available' => $data->where('availability', 'available')->count(),
                'booked' => $data->where('availability', 'booked')->count(),
                'on_trip' => $data->where('availability', 'on_trip')->count(),
            ],
            'updated_at' => $now->toIso8601String(),
        ]);
    }

    public function show(int $id)
    {
        $vehicle = Vehicle::with(['hub', 'photos', 'host'])->findOrFail($id);
        $user = Auth::guard('sanctum')->user();
        $canSee = $vehicle->status === 'live' || ($user && ($user->isAdmin() || $user->id === $vehicle->host_id));
        if (! $canSee) abort(404, 'This vehicle is no longer available.');

        if ($user) {
            RecentlyViewed::updateOrCreate(['user_id' => $user->id, 'vehicle_id' => $vehicle->id], ['viewed_at' => now()]);
        }
        $reviews = $vehicle->reviews()->with('renter')->latest()->limit(4)->get();
        $breakdown = $vehicle->reviews()->selectRaw('rating, COUNT(*) as total')->groupBy('rating')->pluck('total', 'rating');

        return response()->json(Present::vehicleDetail($vehicle) + [
            'is_favorite' => $user ? Favorite::where(['user_id' => $user->id, 'vehicle_id' => $vehicle->id])->exists() : false,
            'reviews' => $reviews->map(fn ($r) => Present::review($r))->values(),
            'rating_breakdown' => collect([5, 4, 3, 2, 1])->mapWithKeys(fn ($s) => [$s => (int) ($breakdown[$s] ?? 0)]),
            'booked_ranges' => $vehicle->bookings()->blocking()->where('return_at', '>', now())->orderBy('pickup_at')
                ->get(['pickup_at', 'return_at'])->map(fn ($b) => ['from' => $b->pickup_at->toIso8601String(), 'to' => $b->return_at->toIso8601String()]),
            'similar' => Vehicle::live()->with(['hub', 'photos'])->where('type', $vehicle->type)->where('id', '!=', $vehicle->id)
                ->orderByDesc('rating_avg')->limit(3)->get()->map(fn ($v) => Present::vehicleCard($v))->values(),
        ]);
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
        $available = ! $vehicle->bookings()->blocking()->where('pickup_at', '<', $return)->where('return_at', '>', $pickup)->exists();
        return response()->json($quote + ['available' => $available]);
    }

    public function hubs()
    {
        return response()->json(['data' => Hub::orderBy('name')->get()]);
    }

    public function stats()
    {
        return response()->json([
            'vehicles' => Vehicle::live()->count(),
            'hosts' => Vehicle::live()->distinct('host_id')->count('host_id'),
            'cities' => Vehicle::live()->whereNotNull('city')->distinct('city')->count('city'),
            'avg_rating' => round((float) Vehicle::live()->where('rating_count', '>', 0)->avg('rating_avg'), 1),
            'min_rate' => (int) Vehicle::live()->min('daily_rate'),
        ]);
    }
}
