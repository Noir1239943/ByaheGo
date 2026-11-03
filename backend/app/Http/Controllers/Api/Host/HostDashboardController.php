<?php

namespace App\Http\Controllers\Api\Host;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Payout;
use App\Support\Present;
use Illuminate\Http\Request;

class HostDashboardController extends Controller
{
    public function dashboard(Request $request)
    {
        $host = $request->user();
        $vehicles = $host->vehicles();
        $bookings = Booking::where('host_id', $host->id);
        $monthStart = now()->startOfMonth();

        return response()->json([
            'stats' => [
                'earnings_this_month' => (int) (clone $bookings)->where('status', 'completed')->where('actual_return_at', '>=', $monthStart)->sum('host_earnings'),
                'upcoming_bookings' => (clone $bookings)->where('status', 'confirmed')->count(),
                'active_trips' => (clone $bookings)->where('status', 'active')->count(),
                'live_listings' => (clone $vehicles)->where('status', 'live')->count(),
                'total_listings' => (clone $vehicles)->count(),
                'rating' => round((float) (clone $vehicles)->where('rating_count', '>', 0)->avg('rating_avg'), 1),
                'reviews' => (int) (clone $vehicles)->sum('rating_count'),
                'pending_payouts' => (int) Payout::where('host_id', $host->id)->where('status', 'scheduled')->sum('amount'),
            ],
            'setup' => [
                'account' => true,
                'identity' => $host->isVerified(),
                'payout' => (bool) $host->payout_method,
                'vehicle' => (clone $vehicles)->whereIn('status', ['pending', 'live', 'paused'])->exists(),
            ],
            'today' => (clone $bookings)->with(['vehicle.hub', 'vehicle.photos', 'renter'])
                ->where(fn ($q) => $q->where(fn ($w) => $w->where('status', 'confirmed')->whereBetween('pickup_at', [now()->subHours(12), now()->addDays(2)]))
                    ->orWhere(fn ($w) => $w->where('status', 'active')->where('return_at', '<=', now()->addDays(2))))
                ->orderBy('pickup_at')->limit(6)->get()->map(fn ($b) => Present::bookingRow($b)),
            'recent' => (clone $bookings)->with(['vehicle.hub', 'vehicle.photos', 'renter'])->latest()->limit(5)->get()->map(fn ($b) => Present::bookingRow($b)),
        ]);
    }

    public function earnings(Request $request)
    {
        $host = $request->user();
        $completed = Booking::where('host_id', $host->id)->where('status', 'completed')->whereNotNull('settled_at');
        $months = collect(range(11, 0))->map(function ($i) use ($completed) {
            $start = now()->startOfMonth()->subMonths($i);
            return [
                'label' => $start->format('M'),
                'month' => $start->format('Y-m'),
                'amount' => (int) (clone $completed)->whereBetween('actual_return_at', [$start, $start->copy()->endOfMonth()])->sum('host_earnings'),
            ];
        });
        $payouts = Payout::with('booking.vehicle')->where('host_id', $host->id)->latest('id')->limit(50)->get();
        return response()->json([
            'summary' => [
                'lifetime' => (int) (clone $completed)->sum('host_earnings'),
                'this_month' => $months->last()['amount'],
                'paid_out' => (int) Payout::where('host_id', $host->id)->where('status', 'paid')->sum('amount'),
                'scheduled' => (int) Payout::where('host_id', $host->id)->where('status', 'scheduled')->sum('amount'),
                'trips' => (clone $completed)->count(),
            ],
            'months' => $months,
            'payouts' => $payouts->map(fn ($p) => [
                'id' => $p->id, 'amount' => $p->amount, 'status' => $p->status,
                'scheduled_for' => $p->scheduled_for?->toDateString(), 'paid_at' => $p->paid_at?->toIso8601String(), 'reference' => $p->reference,
                'booking_reference' => $p->booking?->reference, 'vehicle_name' => $p->booking?->vehicle?->name,
            ]),
            'payout_account' => Present::user($host)['payout'],
        ]);
    }
}
