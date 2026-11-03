<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Favorite;
use App\Models\Payment;
use App\Models\RecentlyViewed;
use App\Models\Vehicle;
use App\Support\Present;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AccountController extends Controller
{
    public function me(Request $request)
    {
        $user = $request->user();
        return response()->json([
            'user' => Present::user($user),
            'unread_notifications' => $user->notificationsFeed()->whereNull('read_at')->count(),
        ]);
    }

    public function update(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'email' => ['required', 'email', 'max:120', Rule::unique('users', 'email')->ignore($user->id)],
            'phone' => ['nullable', 'string', 'max:20'],
            'city' => ['nullable', 'string', 'max:80'],
            'notify_email' => ['boolean'],
            'notify_sms' => ['boolean'],
        ]);
        $user->update($data);
        return response()->json(['user' => Present::user($user->fresh())]);
    }

    public function password(Request $request)
    {
        $user = $request->user();
        $rules = ['password' => ['required', 'confirmed', Password::min(8)->letters()->numbers()]];
        if ($user->password) $rules['current_password'] = ['required', 'string'];
        $data = $request->validate($rules);
        if ($user->password && ! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages(['current_password' => 'Your current password is incorrect.']);
        }
        $user->update(['password' => $data['password']]);
        $user->tokens()->where('id', '!=', $user->currentAccessToken()?->id)->delete();
        return response()->json(['message' => 'Password updated.']);
    }

    public function updatePayout(Request $request)
    {
        $data = $request->validate([
            'payout_method' => ['required', Rule::in(['gcash', 'maya', 'bank'])],
            'payout_account_name' => ['required', 'string', 'max:80'],
            'payout_account_number' => ['required', 'string', 'min:6', 'max:30'],
        ]);
        $request->user()->update($data);
        return response()->json(['user' => Present::user($request->user()->fresh())]);
    }

    public function notifications(Request $request)
    {
        $items = $request->user()->notificationsFeed()->latest()->limit(50)->get();
        return response()->json(['data' => $items->map(fn ($n) => $n->only(['id', 'title', 'body', 'link', 'kind']) + [
            'read' => $n->read_at !== null, 'created_at' => $n->created_at?->toIso8601String(),
        ])]);
    }

    public function readNotification(Request $request, int $id)
    {
        $request->user()->notificationsFeed()->whereKey($id)->update(['read_at' => now()]);
        return response()->json(['ok' => true]);
    }

    public function readAllNotifications(Request $request)
    {
        $request->user()->notificationsFeed()->whereNull('read_at')->update(['read_at' => now()]);
        return response()->json(['ok' => true]);
    }

    public function billing(Request $request)
    {
        $user = $request->user();
        $payments = Payment::with('booking.vehicle')->where('user_id', $user->id)->latest('id')->get();
        $sum = fn ($types) => (int) $payments->whereIn('type', $types)->sum('amount');
        return response()->json([
            'summary' => [
                'total_paid' => $sum(['charge', 'balance']),
                'total_refunded' => $sum(['refund']),
                'fees_and_charges' => $sum(['late_fee', 'damage']),
                'balance_due' => (int) $user->bookings()->sum('balance_due'),
                'deposits_on_hold' => (int) $user->bookings()->whereIn('deposit_status', ['held', 'on_hold'])->whereIn('status', ['confirmed', 'active', 'completed'])->sum('security_deposit'),
            ],
            'data' => $payments->map(fn ($p) => Present::payment($p))->values(),
        ]);
    }

    public function favorites(Request $request)
    {
        $favs = Favorite::with(['vehicle.hub', 'vehicle.photos'])->where('user_id', $request->user()->id)->latest()->get()
            ->filter(fn ($f) => $f->vehicle);
        return response()->json(['data' => $favs->map(fn ($f) => Present::vehicleCard($f->vehicle, [
            'price_alert' => $f->price_alert, 'saved_at' => $f->created_at?->toIso8601String(), 'is_available' => $f->vehicle->status === 'live',
        ]))->values()]);
    }

    public function addFavorite(Request $request, Vehicle $vehicle)
    {
        Favorite::firstOrCreate(['user_id' => $request->user()->id, 'vehicle_id' => $vehicle->id]);
        return response()->json(['saved' => true]);
    }

    public function removeFavorite(Request $request, Vehicle $vehicle)
    {
        Favorite::where(['user_id' => $request->user()->id, 'vehicle_id' => $vehicle->id])->delete();
        return response()->json(['saved' => false]);
    }

    public function toggleFavoriteAlert(Request $request, Vehicle $vehicle)
    {
        $fav = Favorite::where(['user_id' => $request->user()->id, 'vehicle_id' => $vehicle->id])->firstOrFail();
        $fav->update(['price_alert' => ! $fav->price_alert]);
        return response()->json(['price_alert' => $fav->price_alert]);
    }

    public function favoriteIds(Request $request)
    {
        return response()->json(['data' => Favorite::where('user_id', $request->user()->id)->pluck('vehicle_id')]);
    }

    public function recentlyViewed(Request $request)
    {
        $rows = RecentlyViewed::with(['vehicle.hub', 'vehicle.photos'])->where('user_id', $request->user()->id)
            ->orderByDesc('viewed_at')->limit(30)->get()->filter(fn ($r) => $r->vehicle && $r->vehicle->status === 'live');
        return response()->json(['data' => $rows->map(fn ($r) => Present::vehicleCard($r->vehicle, ['viewed_at' => $r->viewed_at->toIso8601String()]))->values()]);
    }

    public function clearRecentlyViewed(Request $request)
    {
        RecentlyViewed::where('user_id', $request->user()->id)->delete();
        return response()->json(['ok' => true]);
    }
}
