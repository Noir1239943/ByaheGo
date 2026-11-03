<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\DriverLicense;
use App\Models\HostApplication;
use App\Models\Incident;
use App\Models\Payout;
use App\Models\SupportTicket;
use App\Models\User;
use App\Models\Vehicle;
use App\Support\Present;
use Illuminate\Http\Request;

class AdminOverviewController extends Controller
{
    public function __invoke(Request $request)
    {
        $range = $request->input('range', '30d');
        [$from, $prevFrom] = match ($range) {
            'today' => [now()->startOfDay(), now()->startOfDay()->subDay()],
            '7d' => [now()->subDays(7), now()->subDays(14)],
            'year' => [now()->startOfYear(), now()->startOfYear()->subYear()],
            default => [now()->subDays(30), now()->subDays(60)],
        };
        $valid = fn () => Booking::where('status', '!=', 'cancelled');
        $gbv = (int) $valid()->where('created_at', '>=', $from)->sum('total');
        $prevGbv = (int) $valid()->whereBetween('created_at', [$prevFrom, $from])->sum('total');
        $revenue = (int) $valid()->where('created_at', '>=', $from)->selectRaw('COALESCE(SUM(service_fee),0) + COALESCE(SUM(commission),0) as r')->value('r');
        $bookingCount = $valid()->where('created_at', '>=', $from)->count();
        $cancelled = Booking::where('status', 'cancelled')->where('created_at', '>=', $from)->count();

        $months = collect(range(11, 0))->map(function ($i) use ($valid) {
            $start = now()->startOfMonth()->subMonths($i);
            return ['label' => $start->format('M'), 'amount' => (int) $valid()->whereBetween('created_at', [$start, $start->copy()->endOfMonth()])->sum('total')];
        });

        return response()->json([
            'kpis' => [
                'gross_booking_value' => $gbv,
                'gbv_change' => $prevGbv > 0 ? round(($gbv - $prevGbv) / $prevGbv * 100, 1) : null,
                'platform_revenue' => $revenue,
                'bookings' => $bookingCount,
                'active_rentals' => Booking::where('status', 'active')->count(),
                'returns_today' => Booking::where('status', 'active')->whereDate('return_at', today())->count(),
                'cancellation_rate' => ($bookingCount + $cancelled) > 0 ? round($cancelled / ($bookingCount + $cancelled) * 100, 1) : 0,
                'users' => User::where('role', '!=', 'admin')->count(),
                'live_vehicles' => Vehicle::where('status', 'live')->count(),
            ],
            'attention' => [
                'verifications' => DriverLicense::where('status', 'pending')->count(),
                'listings' => Vehicle::where('status', 'pending')->count(),
                'host_applications' => HostApplication::where('status', 'pending')->count(),
                'disputes' => Incident::where('status', 'open')->count(),
                'payouts' => Payout::where('status', 'scheduled')->where('scheduled_for', '<=', today())->count(),
                'support' => SupportTicket::where('status', 'open')->count(),
            ],
            'months' => $months,
            'recent' => Booking::with(['vehicle.hub', 'vehicle.photos', 'renter', 'host'])->latest()->limit(6)->get()->map(fn ($b) => Present::bookingRow($b)),
        ]);
    }
}
