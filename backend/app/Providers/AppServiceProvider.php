<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
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
        // 5 login attempts per minute for the same account name + IP, with a message people can act on.
        RateLimiter::for('login', fn (Request $request) => Limit::perMinute(5)->by(strtolower((string) $request->input('login')).'|'.$request->ip())
            ->response(fn (Request $r, array $headers) => $this->tooMany('Too many login attempts', $headers, 'login')));
        RateLimiter::for('password-reset', fn (Request $request) => Limit::perMinute(5)->by($request->ip())
            ->response(fn (Request $r, array $headers) => $this->tooMany('Too many requests', $headers, 'email')));

        // Password reset emails link to the website, not the API.
        ResetPassword::createUrlUsing(fn ($user, string $token) => rtrim(config('app.frontend_url'), '/').'/reset-password?'.http_build_query(['token' => $token, 'email' => $user->getEmailForPasswordReset()]));

        // Behind Render's HTTPS proxy, generate https:// links (vehicle photo URLs) so browsers don't block them.
        if ($this->app->environment('production')) {
            URL::forceScheme('https');
        }
    }

    protected function tooMany(string $what, array $headers, string $field)
    {
        $wait = (int) ($headers['Retry-After'] ?? 60);
        $message = "{$what}. Please wait {$wait} seconds and try again.";
        return response()->json(['message' => $message, 'errors' => [$field => [$message]]], 429, $headers);
    }
}
