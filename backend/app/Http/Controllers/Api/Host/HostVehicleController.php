<?php

namespace App\Http\Controllers\Api\Host;

use App\Http\Controllers\Controller;
use App\Models\Hub;
use App\Models\Media;
use App\Models\Vehicle;
use App\Models\VehicleBlockedDate;
use App\Support\Notifier;
use App\Support\Present;
use App\Support\Settings;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class HostVehicleController extends Controller
{
    protected function own(Request $request, int $id): Vehicle
    {
        return Vehicle::with(['hub', 'photos', 'host'])->where('host_id', $request->user()->id)->findOrFail($id);
    }

    public function index(Request $request)
    {
        $q = Vehicle::with(['hub', 'photos', 'host'])->where('host_id', $request->user()->id)->latest();
        if ($status = $request->input('status')) $q->where('status', $status);
        if ($term = $request->input('q')) {
            $like = '%'.mb_strtolower($term).'%';
            $q->where(fn ($w) => $w->whereRaw('LOWER(make) LIKE ?', [$like])->orWhereRaw('LOWER(model) LIKE ?', [$like])->orWhereRaw('LOWER(plate_number) LIKE ?', [$like]));
        }
        $counts = Vehicle::where('host_id', $request->user()->id)->selectRaw('status, COUNT(*) as total')->groupBy('status')->pluck('total', 'status');
        return response()->json(['data' => $q->get()->map(fn ($v) => Present::hostVehicle($v)), 'counts' => $counts]);
    }

    public function show(Request $request, int $id)
    {
        return response()->json(Present::hostVehicle($this->own($request, $id)));
    }

    protected function rules(Request $request): array
    {
        $user = $request->user();
        $ownMedia = fn ($purpose) => ['nullable', 'integer', Rule::exists('media', 'id')->where('user_id', $user->id)->where('purpose', $purpose)];
        return [
            'make' => ['required', 'string', 'max:40'],
            'model' => ['required', 'string', 'max:60'],
            'year' => ['required', 'integer', 'between:1990,'.(now()->year + 1)],
            'type' => ['required', Rule::in(['sedan', 'hatchback', 'suv', 'mpv', 'van', 'pickup', 'motorcycle'])],
            'transmission' => ['required', Rule::in(['automatic', 'manual'])],
            'fuel' => ['required', Rule::in(['gasoline', 'diesel', 'hybrid', 'electric'])],
            'seats' => ['required', 'integer', 'between:1,20'],
            'color' => ['nullable', 'string', 'max:40'],
            'color_hex' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'plate_number' => ['nullable', 'string', 'max:20'],
            'description' => ['nullable', 'string', 'max:2000'],
            'features' => ['nullable', 'array'],
            'features.*' => ['string', 'max:40'],
            'daily_rate' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'weekly_rate' => ['nullable', 'integer', 'min:0', 'max:500000'],
            'with_driver_available' => ['boolean'],
            'driver_fee_per_day' => ['nullable', 'integer', 'min:0', 'max:20000'],
            'instant_book' => ['boolean'],
            'delivery_available' => ['boolean'],
            'delivery_fee' => ['nullable', 'integer', 'min:0', 'max:10000'],
            'pet_friendly' => ['boolean'],
            'min_days' => ['nullable', 'integer', 'between:1,30'],
            'security_deposit' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'late_fee_per_hour' => ['nullable', 'integer', 'min:0', 'max:20000'],
            'pickup_type' => ['nullable', Rule::in(['hub', 'own'])],
            'hub_id' => ['nullable', 'integer', 'exists:hubs,id'],
            'pickup_address' => ['nullable', 'string', 'max:200'],
            'city' => ['nullable', 'string', 'max:80'],
            'area' => ['nullable', 'string', 'max:120'],
            // The pin must be somewhere in the Philippines, so a stray tap on the map can't put a car in the ocean.
            'lat' => ['nullable', 'numeric', 'between:4.5,21.5'],
            'lng' => ['nullable', 'numeric', 'between:116,127'],
            'photo_ids' => ['nullable', 'array', 'max:12'],
            'photo_ids.*' => ['integer', Rule::exists('media', 'id')->where('user_id', $user->id)->where('purpose', 'vehicle_photo')],
            'or_media_id' => $ownMedia('vehicle_or'),
            'cr_media_id' => $ownMedia('vehicle_cr'),
            'ctpl_media_id' => $ownMedia('vehicle_ctpl'),
            'ctpl_expiry' => ['nullable', 'date'],
            'grace_minutes' => ['nullable', 'integer', 'between:0,180'],
            'fuel_policy' => ['nullable', Rule::in(['same_level', 'full_to_full'])],
        ];
    }

    protected function fill(Vehicle $vehicle, array $data): Vehicle
    {
        $photoIds = $data['photo_ids'] ?? null;
        unset($data['photo_ids']);
        foreach (['daily_rate', 'driver_fee_per_day', 'delivery_fee', 'security_deposit', 'late_fee_per_hour', 'min_days', 'grace_minutes', 'fuel_policy'] as $k) {
            if (array_key_exists($k, $data) && $data[$k] === null) unset($data[$k]);
        }
        // Switching from a hub to your own place drops the hub's coordinates: the host has to place a pin.
        if (($data['pickup_type'] ?? null) === 'own' && $vehicle->pickup_type === 'hub' && ! isset($data['lat'])) {
            $data['lat'] = null;
            $data['lng'] = null;
            $data['hub_id'] = null;
        }
        if (($data['pickup_type'] ?? $vehicle->pickup_type) === 'hub' && ! empty($data['hub_id'])) {
            $hub = Hub::find($data['hub_id']);
            $data['city'] = $hub->city;
            $data['lat'] = $hub->lat;
            $data['lng'] = $hub->lng;
        }
        // A new listing without its own deposit gets the platform default.
        if (! $vehicle->exists && ! array_key_exists('security_deposit', $data)) $data['security_deposit'] = (int) Settings::get('default_security_deposit');
        $vehicle->fill($data)->save();
        if ($photoIds !== null) {
            $vehicle->photos()->delete();
            foreach (array_values($photoIds) as $i => $mid) {
                $vehicle->photos()->create(['media_id' => $mid, 'position' => $i]);
            }
        }
        return $vehicle->fresh(['hub', 'photos', 'host']);
    }

    public function store(Request $request)
    {
        $data = $request->validate($this->rules($request));
        $vehicle = $this->fill(new Vehicle(['host_id' => $request->user()->id, 'status' => 'draft']), $data);
        return response()->json(Present::hostVehicle($vehicle), 201);
    }

    public function update(Request $request, int $id)
    {
        $vehicle = $this->own($request, $id);
        $data = $request->validate($this->rules($request));
        $vehicle = $this->fill($vehicle, $data);
        if ($vehicle->status === 'rejected') $vehicle->update(['status' => 'draft']);
        return response()->json(Present::hostVehicle($vehicle->fresh(['hub', 'photos', 'host'])));
    }

    public function submit(Request $request, int $id)
    {
        $vehicle = $this->own($request, $id);
        if (! in_array($vehicle->status, ['draft', 'rejected'], true)) {
            throw ValidationException::withMessages(['status' => 'This listing has already been submitted.']);
        }
        $missing = [];
        if ($vehicle->daily_rate < 300) $missing[] = 'a daily rate (at least ₱300)';
        if ($vehicle->pickup_type === 'hub' ? ! $vehicle->hub_id : ! ($vehicle->pickup_address && $vehicle->city)) $missing[] = 'a pick-up location';
        if ($vehicle->pickup_type !== 'hub' && ($vehicle->lat === null || $vehicle->lng === null)) $missing[] = 'a pin for the pick-up spot on the map';
        if (! $vehicle->plate_number) $missing[] = 'the plate number';
        if ($vehicle->photos->count() < 3) $missing[] = 'at least 3 photos of the car';
        if (! $vehicle->or_media_id || ! $vehicle->cr_media_id) $missing[] = 'photos of the OR and CR';
        if (! $vehicle->ctpl_media_id) $missing[] = 'a photo of the CTPL insurance';
        elseif (! $vehicle->ctpl_expiry || $vehicle->ctpl_expiry->lessThanOrEqualTo(today())) $missing[] = 'a CTPL expiry date that is still valid';
        if ($vehicle->late_fee_per_hour < 1) $missing[] = 'the late return fee per hour';
        if ($missing) {
            throw ValidationException::withMessages(['status' => 'Almost there! Please add '.implode(', ', $missing).' before submitting.']);
        }
        $vehicle->update(['status' => 'pending', 'submitted_at' => now(), 'rejection_reason' => null]);
        Notifier::admins('Listing to review', "{$request->user()->name} submitted {$vehicle->name}.", '/admin/listings/'.$vehicle->id, 'info');
        return response()->json(Present::hostVehicle($vehicle->fresh(['hub', 'photos', 'host'])));
    }

    public function pause(Request $request, int $id)
    {
        $vehicle = $this->own($request, $id);
        if ($vehicle->status !== 'live') throw ValidationException::withMessages(['status' => 'Only live listings can be paused.']);
        $vehicle->update(['status' => 'paused']);
        return response()->json(Present::hostVehicle($vehicle->fresh(['hub', 'photos', 'host'])));
    }

    public function resume(Request $request, int $id)
    {
        $vehicle = $this->own($request, $id);
        if ($vehicle->status !== 'paused') throw ValidationException::withMessages(['status' => 'This listing isn\'t paused.']);
        $vehicle->update(['status' => 'live']);
        return response()->json(Present::hostVehicle($vehicle->fresh(['hub', 'photos', 'host'])));
    }

    public function blockedDates(Request $request, int $id)
    {
        $vehicle = $this->own($request, $id);
        return response()->json(['data' => $vehicle->blockedDates()->where('ends_on', '>=', today())->get()->map(fn ($d) => $this->blockedRow($d))->values()]);
    }

    public function blockDates(Request $request, int $id)
    {
        $vehicle = $this->own($request, $id);
        $data = $request->validate([
            'starts_on' => ['required', 'date', 'after_or_equal:today'],
            'ends_on' => ['required', 'date', 'after_or_equal:starts_on', 'before:+2 years'],
            'reason' => ['nullable', 'string', 'max:120'],
        ], ['starts_on.after_or_equal' => 'Pick a date from today onwards.', 'ends_on.after_or_equal' => 'The last day must not be before the first day.']);
        $from = Carbon::parse($data['starts_on'])->startOfDay();
        $to = Carbon::parse($data['ends_on'])->endOfDay();
        if ($vehicle->bookings()->blocking()->where('pickup_at', '<', $to)->where('return_at', '>', $from)->exists()) {
            throw ValidationException::withMessages(['starts_on' => 'A renter has already booked some of these days. Those trips need to be cancelled or finished first.']);
        }
        $row = $vehicle->blockedDates()->create($data);
        return response()->json($this->blockedRow($row), 201);
    }

    public function unblockDates(Request $request, int $id, int $blockId)
    {
        $this->own($request, $id)->blockedDates()->whereKey($blockId)->firstOrFail()->delete();
        return response()->json(['ok' => true]);
    }

    protected function blockedRow(VehicleBlockedDate $d): array
    {
        return ['id' => $d->id, 'starts_on' => $d->starts_on->toDateString(), 'ends_on' => $d->ends_on->toDateString(), 'reason' => $d->reason];
    }

    public function destroy(Request $request, int $id)
    {
        $vehicle = $this->own($request, $id);
        if ($vehicle->bookings()->exists()) {
            throw ValidationException::withMessages(['status' => 'This vehicle has trip history, so it can\'t be deleted. Pause it instead.']);
        }
        $vehicle->delete();
        return response()->json(['ok' => true]);
    }
}
