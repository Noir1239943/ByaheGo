<?php

namespace App\Http\Controllers\Api\Host;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Incident;
use App\Services\BookingService;
use App\Support\Notifier;
use App\Support\Present;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class HostBookingController extends Controller
{
    public function __construct(protected BookingService $bookings) {}

    protected function own(Request $request, string $reference): Booking
    {
        return Booking::where('reference', $reference)->where('host_id', $request->user()->id)->firstOrFail();
    }

    public function index(Request $request)
    {
        $tab = $request->input('tab', 'upcoming');
        $q = Booking::with(['vehicle.hub', 'vehicle.photos', 'renter', 'incidents'])->where('host_id', $request->user()->id);
        match ($tab) {
            'on_trip' => $q->where('status', 'active')->orderBy('return_at'),
            'completed' => $q->where('status', 'completed')->orderByDesc('return_at'),
            'cancelled' => $q->where('status', 'cancelled')->orderByDesc('cancelled_at'),
            default => $q->where('status', 'confirmed')->orderBy('pickup_at'),
        };
        if ($term = $request->input('q')) {
            $like = '%'.mb_strtolower($term).'%';
            $q->where(fn ($w) => $w->whereRaw('LOWER(reference) LIKE ?', [$like])->orWhereHas('renter', fn ($r) => $r->whereRaw('LOWER(name) LIKE ?', [$like])));
        }
        $counts = Booking::where('host_id', $request->user()->id)->selectRaw('status, COUNT(*) as total')->groupBy('status')->pluck('total', 'status');
        return response()->json([
            'data' => $q->limit(100)->get()->map(fn ($b) => Present::bookingRow($b)),
            'counts' => ['upcoming' => (int) ($counts['confirmed'] ?? 0), 'on_trip' => (int) ($counts['active'] ?? 0),
                'completed' => (int) ($counts['completed'] ?? 0), 'cancelled' => (int) ($counts['cancelled'] ?? 0)],
        ]);
    }

    public function show(Request $request, string $reference)
    {
        return response()->json(Present::booking($this->own($request, $reference), 'host'));
    }

    protected function inspectionRules(): array
    {
        return [
            'odometer' => ['required', 'integer', 'min:0', 'max:2000000'],
            'fuel_level' => ['required', 'integer', 'between:0,100'],
            'checklist' => ['required', 'array'],
            'checklist.*' => ['boolean'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'photo_ids' => ['nullable', 'array'],
        ];
    }

    public function pickup(Request $request, string $reference)
    {
        $data = $request->validate($this->inspectionRules());
        return response()->json(Present::booking($this->bookings->recordPickup($this->own($request, $reference), $data, $request->user()), 'host'));
    }

    public function return(Request $request, string $reference)
    {
        $data = $request->validate($this->inspectionRules() + [
            'actual_return_at' => ['nullable', 'date', 'before_or_equal:'.now()->addMinutes(10)->toIso8601String()],
            'damage_reported' => ['boolean'],
            'damage_type' => ['nullable', Rule::in(['damage', 'missing_parts', 'theft', 'other'])],
            'damage_description' => ['required_if:damage_reported,true', 'nullable', 'string', 'max:2000'],
            'damage_amount' => ['required_if:damage_reported,true', 'nullable', 'integer', 'min:0', 'max:5000000'],
        ], [
            'damage_description.required_if' => 'Please describe the damage or missing items.',
            'damage_amount.required_if' => 'Please enter the estimated repair cost.',
            'actual_return_at.before_or_equal' => 'The return time can\'t be in the future. Record the return when the renter hands back the vehicle.',
        ]);
        return response()->json(Present::booking($this->bookings->recordReturn($this->own($request, $reference), $data, $request->user()), 'host'));
    }

    public function reportIncident(Request $request, string $reference)
    {
        $booking = $this->own($request, $reference);
        if (! in_array($booking->status, ['active', 'completed'], true)) {
            return response()->json(['message' => 'You can report an incident during or after a trip.'], 422);
        }
        $data = $request->validate([
            'type' => ['required', Rule::in(['damage', 'theft', 'missing_parts', 'accident', 'traffic_violation', 'other'])],
            'description' => ['required', 'string', 'min:10', 'max:2000'],
            'amount_claimed' => ['nullable', 'integer', 'min:0', 'max:5000000'],
            'photo_ids' => ['nullable', 'array'],
        ]);
        Incident::create($data + ['booking_id' => $booking->id, 'reporter_id' => $request->user()->id, 'amount_claimed' => $data['amount_claimed'] ?? 0]);
        if ($booking->status === 'completed' && $booking->settled_at === null) $booking->update(['deposit_status' => 'on_hold']);
        $booking->log('incident', 'Host reported: '.str_replace('_', ' ', $data['type']).'.', $request->user()->id);
        Notifier::admins($data['type'] === 'theft' ? 'URGENT: vehicle theft reported' : 'Host filed an incident', "Booking {$booking->reference}: ".str_replace('_', ' ', $data['type']).'.', '/admin/disputes', 'danger');
        Notifier::send($booking->renter_id, 'An incident was reported on your trip', "Your host reported an issue on {$booking->reference}. Our team will contact you.", "/account/trips/{$booking->reference}", 'warning');
        return response()->json(Present::booking($booking->fresh(), 'host'), 201);
    }
}
