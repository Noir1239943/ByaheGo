<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Suspensions end by themselves on their end date.
Artisan::command('accounts:lift-expired', function (\App\Services\AccountStatusService $accounts) {
    $this->info('Lifted '.$accounts->liftAllExpired().' expired suspension(s).');
})->purpose('Reactivate accounts whose suspension has ended');

\Illuminate\Support\Facades\Schedule::command('accounts:lift-expired')->hourly();

// Unpaid pending bookings stop holding their dates, and trips whose deposit was never settled get settled.
Artisan::command('bookings:expire-pending', function (\App\Services\BookingService $bookings) {
    $this->info('Expired '.$bookings->expirePending().' unpaid booking(s).');
})->purpose('Cancel pending bookings whose payment hold has run out');

Artisan::command('deposits:release-due', function (\App\Services\BookingService $bookings) {
    $this->info('Settled '.$bookings->releaseDueDeposits().' deposit(s).');
})->purpose('Settle deposits of completed trips once the release window has passed');

// Checks payments and refunds that are still pending with Xendit. Webhooks normally do this instantly; this is the safety net.
Artisan::command('payments:sync', function (\App\Services\PaymentService $payments) {
    $this->info('Checked '.$payments->syncPending().' pending payment(s) and refund(s).');
})->purpose('Ask Xendit about payments and refunds that are still pending');

\Illuminate\Support\Facades\Schedule::command('payments:sync')->everyFiveMinutes();

// Trips: reminders an hour before the return time, check-ins nobody answered are accepted, returns the host never reviewed complete.
Artisan::command('trips:sweep', function (\App\Services\TripService $trips) {
    $r = $trips->sweep();
    $this->info("Accepted {$r['checkins_accepted']} check-in(s), completed {$r['trips_completed']} trip(s), sent {$r['reminders']} reminder(s).");
})->purpose('Send return reminders, accept unanswered check-ins and complete unreviewed returns');

\Illuminate\Support\Facades\Schedule::command('trips:sweep')->everyTenMinutes();
\Illuminate\Support\Facades\Schedule::command('bookings:expire-pending')->everyMinute();
\Illuminate\Support\Facades\Schedule::command('deposits:release-due')->hourly();
