<?php

namespace App\Providers;

use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Behind Render's HTTPS proxy, generate https:// links (vehicle photo URLs) so browsers don't block them.
        if ($this->app->environment('production')) {
            URL::forceScheme('https');
        }
    }
}
