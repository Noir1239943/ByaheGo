<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Support\Present;
use App\Support\Sql;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminOverviewController extends Controller
{
    /** Just the "needs attention" numbers for the sidebar badges (one query), so every admin page doesn't load the whole overview. */
    public function attention()
    {
        $a = DB::selectOne("select
            (select count(*) from driver_licenses where status = 'pending') as verifications,
            (select count(*) from vehicles where status = 'pending') as listings,
            (select count(*) from host_applications where status = 'pending') as host_applications,
            (select count(*) from incidents where status = 'open') as disputes,
            (select count(*) from payouts where status = 'scheduled' and scheduled_for <= ?) as payouts,
            (select count(*) from support_tickets where status = 'open') as support,
            (select count(*) from bookings where admin_flag is not null and status in ('confirmed', 'active')) as flagged_bookings", [today()->toDateString()]);
        return response()->json(array_map('intval', (array) $a));
    }

    public function __invoke(Request $request)
    {
        $range = $request->input('range', '30d');
        [$from, $prevFrom] = match ($range) {
            'today' => [now()->startOfDay(), now()->startOfDay()->subDay()],
            '7d' => [now()->subDays(7), now()->subDays(14)],
            'year' => [now()->startOfYear(), now()->startOfYear()->subYear()],
            default => [now()->subDays(30), now()->subDays(60)],
        };
        $valid = "status != 'cancelled'";
        // Every number on the page comes from ONE query (scalar sub-selects), not one round trip per number.
        $k = DB::selectOne("select
            (select coalesce(sum(total), 0) from bookings where {$valid} and created_at >= ?) as gbv,
            (select coalesce(sum(total), 0) from bookings where {$valid} and created_at >= ? and created_at < ?) as prev_gbv,
            (select coalesce(sum(service_fee), 0) + coalesce(sum(commission), 0) from bookings where {$valid} and created_at >= ?) as revenue,
            (select count(*) from bookings where {$valid} and created_at >= ?) as bookings,
            (select count(*) from bookings where status = 'cancelled' and created_at >= ?) as cancelled,
            (select count(*) from bookings where status = 'active') as active_rentals,
            (select count(*) from bookings where status = 'active' and return_at >= ? and return_at < ?) as returns_today,
            (select count(*) from bookings where admin_flag is not null and status in ('confirmed', 'active')) as flagged_bookings,
            (select count(*) from users where role != 'admin') as users,
            (select count(*) from vehicles where status = 'live') as live_vehicles,
            (select count(*) from vehicles where status = 'pending') as listings,
            (select count(*) from driver_licenses where status = 'pending') as verifications,
            (select count(*) from host_applications where status = 'pending') as host_applications,
            (select count(*) from incidents where status = 'open') as disputes,
            (select count(*) from payouts where status = 'scheduled' and scheduled_for <= ?) as payouts,
            (select count(*) from support_tickets where status = 'open') as support",
            [$from, $prevFrom, $from, $from, $from, $from, today()->startOfDay(), today()->addDay()->startOfDay(), today()->toDateString()]);
        $gbv = (int) $k->gbv;
        $prevGbv = (int) $k->prev_gbv;
        $bookingCount = (int) $k->bookings;
        $cancelled = (int) $k->cancelled;

        $monthly = Booking::where('status', '!=', 'cancelled')->where('created_at', '>=', now()->startOfMonth()->subMonths(11))
            ->selectRaw(Sql::month('created_at').' as m, SUM(total) as amount')->groupBy('m')->pluck('amount', 'm');
        $months = Sql::twelveMonths($monthly)->map(fn ($m) => ['label' => $m['label'], 'amount' => $m['amount']]);

        return response()->json([
            'kpis' => [
                'gross_booking_value' => $gbv,
                'gbv_change' => $prevGbv > 0 ? round(($gbv - $prevGbv) / $prevGbv * 100, 1) : null,
                'platform_revenue' => (int) $k->revenue,
                'bookings' => $bookingCount,
                'active_rentals' => (int) $k->active_rentals,
                'returns_today' => (int) $k->returns_today,
                'cancellation_rate' => ($bookingCount + $cancelled) > 0 ? round($cancelled / ($bookingCount + $cancelled) * 100, 1) : 0,
                'users' => (int) $k->users,
                'live_vehicles' => (int) $k->live_vehicles,
            ],
            'attention' => [
                'verifications' => (int) $k->verifications,
                'listings' => (int) $k->listings,
                'host_applications' => (int) $k->host_applications,
                'disputes' => (int) $k->disputes,
                'payouts' => (int) $k->payouts,
                'support' => (int) $k->support,
                'flagged_bookings' => (int) $k->flagged_bookings,
            ],
            'months' => $months,
            'recent' => Present::bookingRows(Booking::withRowFlags()->latest()->limit(6)->get(), true),
        ]);
    }
}
