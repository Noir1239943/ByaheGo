<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use App\Models\Booking;
use App\Models\Hub;
use App\Models\PersonalAccessToken;
use App\Models\Review;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleBlockedDate;
use App\Models\VehiclePhoto;
use App\Support\PublicCache;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use Laravel\Sanctum\Sanctum;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Whatever can change a public page retires the cached copies (see PublicCache).
        foreach ([Vehicle::class, VehiclePhoto::class, Booking::class, VehicleBlockedDate::class, Review::class, Hub::class] as $model) {
            $model::saved(fn () => PublicCache::bump());
            $model::deleted(fn () => PublicCache::bump());
        }
        User::saved(fn (User $u) => $u->wasChanged(['status', 'role', 'suspended_until', 'revoked_at']) ? PublicCache::bump() : null);

        Sanctum::usePersonalAccessTokenModel(PersonalAccessToken::class);

        // A relation that is read without being eager-loaded is an N+1 query (one database round trip per row, ~150 ms each
        // on Neon). Outside production it throws, so new ones are caught in development and in the tests.
        Model::preventLazyLoading(! $this->app->isProduction());

        // 5 login attempts per minute for the same account name + IP, with a message people can act on.
        // And 20 per minute from one address whatever the account name, so one machine can't try many accounts.
        RateLimiter::for('login', fn (Request $request) => [
            Limit::perMinute(5)->by(strtolower((string) $request->input('login')).'|'.$request->ip())
                ->response(fn (Request $r, array $headers) => $this->tooMany('Too many login attempts', $headers, 'login')),
            Limit::perMinute(20)->by('login-ip|'.$request->ip())
                ->response(fn (Request $r, array $headers) => $this->tooMany('Too many login attempts', $headers, 'login')),
        ]);
        RateLimiter::for('password-reset', fn (Request $request) => Limit::perMinute(5)->by($request->ip())
            ->response(fn (Request $r, array $headers) => $this->tooMany('Too many requests', $headers, 'email')));

        // Guided photos come in tens at a time, so they get their own counter (a shared one would block the Submit button).
        RateLimiter::for('trip-photos', fn (Request $request) => Limit::perMinute(60)->by('trip-photos|'.($request->user()?->id ?? $request->ip())));

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
