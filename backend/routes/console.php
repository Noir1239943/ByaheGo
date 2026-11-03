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
