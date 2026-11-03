<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Services\TripService;
use App\Support\Present;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** The renter's side of a trip: guided check-in and check-out photos, and asking for more time. */
class TripController extends Controller
{
    public function __construct(protected TripService $trips) {}

    protected function own(Request $request, string $reference): Booking
    {
        return Booking::where('reference', $reference)->where('renter_id', $request->user()->id)->firstOrFail();
    }

    protected function stage(string $stage): string
    {
        abort_unless(in_array($stage, ['checkin', 'checkout'], true), 404);
        return $stage;
    }

    public function wizard(Request $request, string $reference, string $stage)
    {
        return response()->json($this->trips->wizard($this->own($request, $reference), $this->stage($stage)));
    }

    public function storePhoto(Request $request, string $reference, string $stage)
    {
        $data = $request->validate([
            'file' => ['required', 'file', 'mimes:jpg,jpeg,png,webp', 'max:8192'],
            'angle' => ['required', 'string', 'max:20'],
            'live' => ['nullable', 'boolean'],
            'device_time' => ['nullable', 'date'],
            'lat' => ['nullable', 'numeric', 'between:-90,90'],
            'lng' => ['nullable', 'numeric', 'between:-180,180'],
            'note' => ['nullable', 'string', 'max:255'],
        ], ['file.max' => 'That photo is too large. Please take it again.']);
        $photo = $this->trips->storePhoto($this->own($request, $reference), $request->user(), $this->stage($stage), $request->file('file'), $data);
        return response()->json(['id' => $photo->id, 'angle' => $photo->angle, 'media_id' => $photo->media_id, 'live' => $photo->live, 'note' => $photo->note], 201);
    }

    public function deletePhoto(Request $request, string $reference, string $stage, int $id)
    {
        $this->trips->deleteDraft($this->own($request, $reference), $request->user(), $id);
        return response()->json(['ok' => true]);
    }

    public function submit(Request $request, string $reference, string $stage)
    {
        $data = $request->validate([
            'odometer' => ['required', 'integer', 'min:0', 'max:2000000'],
            'fuel_level' => ['required', 'integer', Rule::in(TripService::FUEL_LEVELS)],
            'notes' => ['nullable', 'string', 'max:1000'],
        ], ['odometer.required' => 'Enter what the odometer shows.', 'fuel_level.required' => 'Choose the fuel level.']);
        $booking = $this->own($request, $reference);
        $this->trips->submit($booking, $request->user(), $this->stage($stage), $data);
        return response()->json(Present::booking($booking->fresh()), 201);
    }

    /** The renter pays for an extension the host approved. Returns the Xendit page to go to. */
    public function payExtension(Request $request, string $reference)
    {
        $data = $request->validate(['payment_method' => ['nullable', Rule::in(array_keys(\App\Services\PaymentGateway::METHODS))]]);
        $booking = $this->own($request, $reference);
        $payment = $this->trips->payExtension($booking, $data['payment_method'] ?? null);
        return response()->json(['checkout_url' => $payment->status === 'pending' ? $payment->checkout_url : null, 'booking' => Present::booking($booking->fresh())]);
    }

    public function requestExtension(Request $request, string $reference)
    {
        $data = $request->validate(['return_at' => ['required', 'date'], 'note' => ['nullable', 'string', 'max:255']]);
        $booking = $this->own($request, $reference);
        $this->trips->requestExtension($booking, $request->user(), Carbon::parse($data['return_at']), $data['note'] ?? null);
        return response()->json(Present::booking($booking->fresh()), 201);
    }
}
