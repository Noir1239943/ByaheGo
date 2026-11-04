<?php

namespace App\Http\Controllers\Api\Host;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Payout;
use App\Support\Present;
use App\Support\Sql;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class HostDashboardController extends Controller
{
    public function dashboard(Request $request)
    {
        $host = $request->user();
        $monthStart = now()->startOfMonth();

        // The headline numbers come from one query (sub-selects), not one round trip per number.
        $s = DB::selectOne("select
            (select coalesce(sum(host_earnings), 0) from bookings where host_id = ? and status = 'completed' and actual_return_at >= ?) as earnings_this_month,
            (select count(*) from bookings where host_id = ? and status = 'confirmed') as upcoming,
            (select count(*) from bookings where host_id = ? and status = 'active') as active,
            (select count(*) from vehicles where host_id = ? and status = 'live') as live,
            (select count(*) from vehicles where host_id = ?) as total,
            (select count(*) from vehicles where host_id = ? and status in ('pending', 'live', 'paused')) as has_vehicle,
            (select avg(rating_avg) from vehicles where host_id = ? and rating_count > 0) as rating,
            (select coalesce(sum(rating_count), 0) from vehicles where host_id = ?) as reviews,
            (select coalesce(sum(amount), 0) from payouts where host_id = ? and status = 'scheduled') as pending_payouts",
            [$host->id, $monthStart, $host->id, $host->id, $host->id, $host->id, $host->id, $host->id, $host->id, $host->id]);

        $mine = fn () => Booking::withRowFlags()->where('host_id', $host->id);
        $today = $mine()
            ->where(fn ($q) => $q->where(fn ($w) => $w->where('status', 'confirmed')->whereBetween('pickup_at', [now()->subHours(12), now()->addDays(2)]))
                ->orWhere(fn ($w) => $w->where('status', 'active')->where('return_at', '<=', now()->addDays(2))))
            ->orderBy('pickup_at')->limit(6)->get();
        $recent = $mine()->latest()->limit(5)->get();
        // Both lists share one set of vehicle / photo / renter queries.
        $rows = Present::bookingRows(new EloquentCollection([...$today->all(), ...$recent->all()]));

        return response()->json([
            'stats' => [
                'earnings_this_month' => (int) $s->earnings_this_month,
                'upcoming_bookings' => (int) $s->upcoming,
                'active_trips' => (int) $s->active,
                'live_listings' => (int) $s->live,
                'total_listings' => (int) $s->total,
                'rating' => round((float) $s->rating, 1),
                'reviews' => (int) $s->reviews,
                'pending_payouts' => (int) $s->pending_payouts,
            ],
            'setup' => [
                'account' => true,
                'identity' => $host->isVerified(),
                'payout' => (bool) $host->payout_method,
                'vehicle' => (int) $s->has_vehicle > 0,
            ],
            'today' => $rows->take($today->count())->values(),
            'recent' => $rows->slice($today->count())->values(),
        ]);
    }

    public function earnings(Request $request)
    {
        $host = $request->user();
        $since = now()->startOfMonth()->subMonths(11);
        $completed = fn () => Booking::where('host_id', $host->id)->where('status', 'completed')->whereNotNull('settled_at');
        // Twelve monthly totals from one grouped query.
        $perMonth = $completed()->where('actual_return_at', '>=', $since)->selectRaw(Sql::month('actual_return_at').' as m, SUM(host_earnings) as amount')->groupBy('m')->pluck('amount', 'm');
        $months = Sql::twelveMonths($perMonth);
        $t = DB::selectOne("select
            (select coalesce(sum(host_earnings), 0) from bookings where host_id = ? and status = 'completed' and settled_at is not null) as lifetime,
            (select count(*) from bookings where host_id = ? and status = 'completed' and settled_at is not null) as trips,
            (select coalesce(sum(amount), 0) from payouts where host_id = ? and status = 'paid') as paid_out,
            (select coalesce(sum(amount), 0) from payouts where host_id = ? and status = 'scheduled') as scheduled", array_fill(0, 4, $host->id));
        $payouts = Payout::with('booking.vehicle')->where('host_id', $host->id)->latest('id')->limit(50)->get();
        return response()->json([
            'summary' => [
                'lifetime' => (int) $t->lifetime,
                'this_month' => $months->last()['amount'],
                'paid_out' => (int) $t->paid_out,
                'scheduled' => (int) $t->scheduled,
                'trips' => (int) $t->trips,
            ],
            'months' => $months,
            'payouts' => $payouts->map(fn ($p) => [
                'id' => $p->id, 'amount' => $p->amount, 'status' => $p->status,
                'scheduled_for' => $p->scheduled_for?->toDateString(), 'paid_at' => $p->paid_at?->toIso8601String(), 'reference' => $p->reference,
                'booking_reference' => $p->booking?->reference, 'vehicle_name' => $p->booking?->vehicle?->name,
            ]),
            'payout_account' => $host->payout_method ? ['method' => $host->payout_method, 'account_name' => $host->payout_account_name, 'account_masked' => $host->maskedPayoutAccount()] : null,
        ]);
    }
}
