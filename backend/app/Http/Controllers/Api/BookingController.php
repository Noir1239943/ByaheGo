<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Incident;
use App\Models\Vehicle;
use App\Services\AgreementService;
use App\Services\BookingService;
use App\Services\PricingService;
use App\Services\PaymentGateway;
use App\Support\Notifier;
use App\Support\Present;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Rule;

class BookingController extends Controller
{
    public function __construct(protected BookingService $bookings) {}

    protected function own(Request $request, string $reference): Booking
    {
        return Booking::where('reference', $reference)->where('renter_id', $request->user()->id)->firstOrFail();
    }

    public function index(Request $request)
    {
        $tab = $request->input('tab', 'upcoming');
        $q = Booking::with(['vehicle.hub', 'vehicle.photos', 'host', 'review', 'incidents'])->where('renter_id', $request->user()->id);
        match ($tab) {
            'active' => $q->where('status', 'active')->orderBy('return_at'),
            'past' => $q->where('status', 'completed')->orderByDesc('return_at'),
            'cancelled' => $q->where('status', 'cancelled')->orderByDesc('cancelled_at'),
            default => $q->where('status', 'confirmed')->orderBy('pickup_at'),
        };
        $counts = Booking::where('renter_id', $request->user()->id)->selectRaw('status, COUNT(*) as total')->groupBy('status')->pluck('total', 'status');
        return response()->json([
            'data' => $q->get()->map(fn ($b) => Present::bookingRow($b))->values(),
            'counts' => [
                'upcoming' => (int) ($counts['confirmed'] ?? 0),
                'active' => (int) ($counts['active'] ?? 0),
                'past' => (int) ($counts['completed'] ?? 0),
                'cancelled' => (int) ($counts['cancelled'] ?? 0),
            ],
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'vehicle_id' => ['required', 'integer', 'exists:vehicles,id'],
            'pickup_at' => ['required', 'date'],
            'return_at' => ['required', 'date'],
            'rental_type' => ['required', Rule::in(['self', 'driver'])],
            'protection_plan' => ['required', Rule::in(['standard', 'plus', 'premium'])],
            'driver_name' => ['required', 'string', 'max:80'],
            'driver_phone' => ['required', 'string', 'max:20'],
            'driver_email' => ['required', 'email'],
            'payment_method' => ['required', Rule::in(array_keys(PaymentGateway::METHODS))],
            'wallet_number' => ['nullable', 'string', 'max:20'],
            'card_number' => ['nullable', 'string', 'max:25'],
            'card_expiry' => ['nullable', 'string', 'max:7'],
            'card_cvc' => ['nullable', 'string', 'max:4'],
            'card_name' => ['nullable', 'string', 'max:80'],
            'agree_terms' => ['accepted'],
            'agreement_read_to_end' => ['accepted'],
            'signature_name' => ['required', 'string', 'max:120'],
            'agreement_hash' => ['required', 'string', 'size:64'],
            'confirm_age' => ['accepted_if:rental_type,self'],
        ], [
            'agree_terms.accepted' => 'Please read and accept the rental agreement to continue.',
            'agreement_read_to_end.accepted' => 'Please scroll to the end of the rental agreement before you sign.',
            'signature_name.required' => 'Type your full name to sign the agreement.',
            'confirm_age.accepted_if' => 'Please confirm you\'re at least 21 and have a valid license.',
            'driver_phone.required' => 'Please add a mobile number so your host can reach you.',
        ]);
        $vehicle = Vehicle::with(['hub', 'host'])->findOrFail($data['vehicle_id']);
        $booking = $this->bookings->create($request->user()->load('latestLicense'), $vehicle, $data, $request->ip(), $request->userAgent());
        return response()->json(Present::booking($booking->fresh()), 201);
    }

    /** The agreement filled in for this trip, shown before payment. Nothing is stored until the booking is made. */
    public function agreementPreview(Request $request, int $id, PricingService $pricing, AgreementService $agreements)
    {
        $data = $request->validate([
            'pickup_at' => ['required', 'date'],
            'return_at' => ['required', 'date'],
            'rental_type' => ['required', Rule::in(['self', 'driver'])],
            'protection_plan' => ['required', Rule::in(['standard', 'plus', 'premium'])],
        ]);
        $vehicle = Vehicle::with(['hub', 'host'])->findOrFail($id);
        $user = $request->user()->load('latestLicense');
        if ($data['rental_type'] === 'self' && ! $user->isVerified()) {
            throw ValidationException::withMessages(['verification' => 'Please verify your driver\'s license before booking a self-drive trip.']);
        }
        $pickup = Carbon::parse($data['pickup_at']);
        $return = Carbon::parse($data['return_at']);
        $quote = $pricing->quote($vehicle, $pickup, $return, $data['rental_type'], $data['protection_plan']);
        $built = $agreements->build($vehicle, $user, $quote, $pickup, $return, $data['rental_type']);
        return response()->json($built + ['free_cancellation_until' => $quote['free_cancellation_until']]);
    }

    public function agreementPdf(Request $request, string $reference, AgreementService $agreements)
    {
        return $agreements->download($this->own($request, $reference));
    }

    public function show(Request $request, string $reference)
    {
        return response()->json(Present::booking($this->own($request, $reference)));
    }

    public function cancel(Request $request, string $reference)
    {
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:200']]);
        $booking = $this->bookings->cancel($this->own($request, $reference), 'renter', $data['reason'] ?? null, $request->user());
        return response()->json(Present::booking($booking));
    }

    public function payBalance(Request $request, string $reference)
    {
        $data = $request->validate([
            'payment_method' => ['required', Rule::in(array_keys(PaymentGateway::METHODS))],
            'wallet_number' => ['nullable', 'string'], 'card_number' => ['nullable', 'string'],
            'card_expiry' => ['nullable', 'string'], 'card_cvc' => ['nullable', 'string'],
        ]);
        $booking = $this->bookings->payBalance($this->own($request, $reference), $data);
        return response()->json(Present::booking($booking));
    }

    public function review(Request $request, string $reference)
    {
        $booking = $this->own($request, $reference);
        if ($booking->status !== 'completed' || $booking->review()->exists()) {
            return response()->json(['message' => 'You can review a trip once, after it ends.'], 422);
        }
        $data = $request->validate(['rating' => ['required', 'integer', 'between:1,5'], 'comment' => ['nullable', 'string', 'max:1000']]);
        $booking->review()->create($data + ['vehicle_id' => $booking->vehicle_id, 'renter_id' => $booking->renter_id]);
        $vehicle = $booking->vehicle;
        $vehicle->update([
            'rating_avg' => round((float) $vehicle->reviews()->avg('rating'), 2),
            'rating_count' => $vehicle->reviews()->count(),
        ]);
        Notifier::send($booking->host_id, 'New review', "{$request->user()->name} rated your {$vehicle->name} {$data['rating']}★.", "/host/bookings/{$booking->reference}", 'info');
        return response()->json(Present::booking($booking->fresh()));
    }

    public function reportIncident(Request $request, string $reference)
    {
        $booking = $this->own($request, $reference);
        if (! in_array($booking->status, ['active', 'completed'], true)) {
            return response()->json(['message' => 'You can report a problem during or after your trip.'], 422);
        }
        $data = $request->validate([
            'type' => ['required', Rule::in(['accident', 'breakdown', 'damage', 'other'])],
            'description' => ['required', 'string', 'min:10', 'max:2000'],
            'photo_ids' => ['nullable', 'array'],
        ], ['description.min' => 'Please tell us a bit more about what happened.']);
        Incident::create($data + ['booking_id' => $booking->id, 'reporter_id' => $request->user()->id]);
        $booking->log('incident', 'Renter reported: '.$data['type'].'.', $request->user()->id);
        Notifier::admins('Renter reported a problem', "Booking {$booking->reference}: {$data['type']}.", '/admin/disputes', 'warning');
        Notifier::send($booking->host_id, 'Your renter reported a problem', "Booking {$booking->reference}: {$data['type']}. Our team is on it.", "/host/bookings/{$booking->reference}", 'warning');
        return response()->json(Present::booking($booking->fresh()), 201);
    }
}
