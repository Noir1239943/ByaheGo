<?php

namespace App\Services;

use App\Models\Vehicle;
use App\Support\Protection;
use App\Support\Settings;
use Carbon\CarbonInterface;
use Illuminate\Validation\ValidationException;

class PricingService
{
    public const MAX_DAYS = 30;

    /**
     * Build a full price breakdown for a trip. Throws a validation error when the dates don't work.
     */
    public function quote(Vehicle $vehicle, CarbonInterface $pickup, CarbonInterface $return, string $rentalType = 'self', string $plan = 'standard', bool $checkFuture = true): array
    {
        if ($return->lessThanOrEqualTo($pickup)) {
            throw ValidationException::withMessages(['return_at' => 'Your return time needs to be after your pick-up time.']);
        }
        if ($checkFuture && $pickup->lessThan(now()->addHour())) {
            throw ValidationException::withMessages(['pickup_at' => 'Pick-up needs to be at least 1 hour from now.']);
        }
        $hours = (int) ceil($pickup->diffInMinutes($return) / 60);
        $days = max(1, (int) ceil($hours / 24));
        if ($days > self::MAX_DAYS) {
            throw ValidationException::withMessages(['return_at' => 'Trips can be up to '.self::MAX_DAYS.' days long. For longer rentals, contact us.']);
        }
        if ($days < $vehicle->min_days) {
            throw ValidationException::withMessages(['return_at' => "This vehicle needs to be booked for at least {$vehicle->min_days} days."]);
        }
        if ($rentalType === 'driver' && ! $vehicle->with_driver_available) {
            throw ValidationException::withMessages(['rental_type' => 'This vehicle is only available for self-drive.']);
        }

        $rental = $vehicle->daily_rate * $days;
        if ($vehicle->weekly_rate && $days >= 7) {
            $weekly = intdiv($days, 7) * $vehicle->weekly_rate + ($days % 7) * $vehicle->daily_rate;
            $rental = min($rental, $weekly);
        }
        $driverFee = $rentalType === 'driver' ? $vehicle->driver_fee_per_day * $days : 0;
        $planInfo = Protection::get($plan);
        $protection = $planInfo['price_per_day'] * $days;
        $serviceFee = (int) round(($rental + $driverFee) * Settings::get('service_fee_rate') / 100);
        $total = $rental + $driverFee + $protection + $serviceFee;

        return [
            'days' => $days,
            'hours' => $hours,
            'daily_rate' => $vehicle->daily_rate,
            'rental_subtotal' => $rental,
            'weekly_discount' => $vehicle->daily_rate * $days - $rental,
            'driver_fee_total' => $driverFee,
            'protection_plan' => $planInfo['key'],
            'protection_name' => $planInfo['name'],
            'protection_total' => $protection,
            'liability_cap' => $planInfo['liability_cap'],
            'service_fee' => $serviceFee,
            'service_fee_rate' => Settings::get('service_fee_rate'),
            'total' => $total,
            'security_deposit' => $vehicle->security_deposit,
            'due_now' => $total + $vehicle->security_deposit,
            'cancellation_fee' => min((int) Settings::get('cancellation_fee'), $total),
            'free_cancellation_until' => $pickup->copy()->subHours((int) Settings::get('cancellation_cutoff_hours'))->toIso8601String(),
        ];
    }

    /** Late fee for returning after the scheduled time. */
    public function lateFee(Vehicle $vehicle, CarbonInterface $scheduledReturn, CarbonInterface $actualReturn): array
    {
        $minutesLate = $scheduledReturn->diffInMinutes($actualReturn, false);
        // Each listing sets its own grace period; the platform setting is only the fallback.
        $grace = $vehicle->grace_minutes ?? Settings::get('late_grace_minutes');
        if ($minutesLate <= $grace) {
            return ['hours' => 0, 'fee' => 0];
        }
        $hours = (int) ceil($minutesLate / 60);
        $fee = $hours * $vehicle->late_fee_per_hour;
        $cap = (int) round(ceil($hours / 24) * $vehicle->daily_rate * Settings::get('late_fee_daily_cap'));

        return ['hours' => $hours, 'fee' => min($fee, $cap)];
    }
}
