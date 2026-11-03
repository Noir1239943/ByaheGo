<?php

namespace App\Support;

use App\Models\Setting;
use Illuminate\Support\Facades\Schema;

class Settings
{
    public const DEFAULTS = [
        'service_fee_rate' => 7.5,        // % of rental + driver fees, charged to renter
        'commission_rate' => 15,          // % of rental + driver fees kept by the platform
        'late_grace_minutes' => 30,       // minutes after return time before late fees start (a listing can set its own)
        'cancellation_cutoff_hours' => 24, // free cancellation until this many hours before pick-up
        'late_fee_daily_cap' => 1.5,      // late fees are capped at this multiple of the daily rate per 24h late
        'deposit_release_days' => 3,
        'default_security_deposit' => 3000, // pesos; used when a host does not set a deposit on a listing
        'cancellation_fee' => 0,          // pesos kept when a renter cancels in time (0 = fully free)
        'pending_booking_minutes' => 30,  // an unpaid pending booking holds the dates this long
        'excess_hours_full_day' => 5,     // this many hours late (within a day) counts as one extra full day
        'checkin_host_window_hours' => 12, // the host can confirm or add to the check-in photos this long; no answer = accepted
        'host_review_hours' => 24,        // after the renter's check-out the host decides this fast, or the trip completes by itself
        'theft_overdue_hours' => 3,       // hours past the return time before a host can report "car not returned"
    ];

    public const LABELS = [
        'service_fee_rate' => 'Service fee (%)',
        'commission_rate' => 'Platform commission (%)',
        'late_grace_minutes' => 'Late return grace period (minutes)',
        'cancellation_cutoff_hours' => 'Free cancellation cut-off (hours before pick-up)',
        'late_fee_daily_cap' => 'Late fee cap (× daily rate per day late)',
        'deposit_release_days' => 'Deposit release window (days)',
        'default_security_deposit' => 'Default security deposit (₱)',
        'cancellation_fee' => 'Cancellation fee for in-time cancellations (₱)',
        'pending_booking_minutes' => 'Unpaid booking hold (minutes)',
        'excess_hours_full_day' => 'Hours late that count as one extra full day',
        'checkin_host_window_hours' => 'Host check-in review window (hours)',
        'host_review_hours' => 'Host return review window (hours)',
        'theft_overdue_hours' => 'Hours overdue before "car not returned" can be reported',
    ];

    protected static ?array $cache = null;

    public static function all(): array
    {
        if (static::$cache === null) {
            $stored = Schema::hasTable('settings') ? Setting::pluck('value', 'key')->all() : [];
            static::$cache = [];
            foreach (static::DEFAULTS as $k => $v) {
                static::$cache[$k] = isset($stored[$k]) ? (float) $stored[$k] : (float) $v;
            }
        }
        return static::$cache;
    }

    public static function get(string $key): float
    {
        return static::all()[$key] ?? (float) (static::DEFAULTS[$key] ?? 0);
    }

    public static function set(array $values): void
    {
        foreach ($values as $k => $v) {
            if (array_key_exists($k, static::DEFAULTS)) {
                Setting::updateOrCreate(['key' => $k], ['value' => (string) $v]);
            }
        }
        static::$cache = null;
    }

    public static function flush(): void
    {
        static::$cache = null;
    }
}
