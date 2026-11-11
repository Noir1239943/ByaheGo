<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SocialAccount;
use App\Models\User;
use App\Services\AccountStatusService;
use App\Support\Notifier;
use App\Support\Present;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Socialite\Facades\Socialite;
use Throwable;

/**
 * "Continue with Google / Facebook".
 *
 * Browser -> GET /api/auth/{provider}/redirect -> provider -> GET /api/auth/{provider}/callback -> frontend /auth/callback?code=...
 * The frontend then POSTs the one-time code to /api/auth/social/exchange to get its normal API token, so a token never
 * appears in a URL. Socialite runs stateless (no session on this API), so the OAuth `state` is our own random value kept in cache.
 */
class SocialAuthController extends Controller
{
    public const PROVIDERS = ['google', 'facebook'];

    public static function enabled(string $provider): bool
    {
        return in_array($provider, self::PROVIDERS, true)
            && filled(config("services.{$provider}.client_id")) && filled(config("services.{$provider}.client_secret"));
    }

    protected function frontend(string $path, array $query = [])
    {
        return redirect()->away(rtrim(config('app.frontend_url'), '/').$path.($query ? '?'.http_build_query($query) : ''));
    }

    protected function failed(string $code)
    {
        return $this->frontend('/auth/callback', ['error' => $code]);
    }

    public function redirect(string $provider)
    {
        if (! self::enabled($provider)) return $this->failed('not_configured');
        $state = Str::random(40);
        Cache::put("oauth_state:{$state}", $provider, now()->addMinutes(10));
        return Socialite::driver($provider)->stateless()->with(['state' => $state])->redirect();
    }

    public function callback(Request $request, string $provider)
    {
        if (! self::enabled($provider)) return $this->failed('not_configured');
        // Google and Facebook both answer "access_denied" when the person presses Cancel; anything else is a provider problem.
        if ($request->filled('error')) return $this->failed($request->input('error') === 'access_denied' ? 'cancelled' : 'provider_error');
        $state = (string) $request->input('state');
        if ($state === '' || Cache::pull("oauth_state:{$state}") !== $provider) return $this->failed('invalid_state');

        try {
            $info = Socialite::driver($provider)->stateless()->user();
        } catch (Throwable) {
            return $this->failed('provider_error');
        }

        $pid = (string) $info->getId();
        $email = $info->getEmail() ? strtolower($info->getEmail()) : null;
        // Google says so explicitly. Facebook only returns an email address once it has been confirmed.
        $verified = $email !== null && ($provider === 'facebook' || filter_var($info->user['email_verified'] ?? $info->user['verified_email'] ?? false, FILTER_VALIDATE_BOOLEAN));

        $account = SocialAccount::where(['provider' => $provider, 'provider_user_id' => $pid])->first();
        $user = $account?->user;
        $created = false;

        if (! $user) {
            if ($email === null) {
                // Facebook sometimes returns no email: ask the person for one before finishing sign-up.
                $code = Str::random(48);
                Cache::put("oauth_pending:{$code}", ['provider' => $provider, 'pid' => $pid, 'name' => $info->getName()], now()->addMinutes(10));
                return $this->frontend('/auth/callback', ['code' => $code, 'need_email' => 1]);
            }
            $existing = User::where('email', $email)->first();
            if ($existing && ! $verified) return $this->failed('email_in_use'); // never link on an unconfirmed email
            if ($existing) {
                $user = $existing;
            } else {
                $user = $this->createUser($info->getName(), $email, $verified);
                $created = true;
            }
            SocialAccount::create(['user_id' => $user->id, 'provider' => $provider, 'provider_user_id' => $pid]);
        }
        if ($created) $this->welcome($user);

        return $this->frontend('/auth/callback', ['code' => $this->issueCode($user)]);
    }

    /** Swap the one-time code for our normal API token. */
    public function exchange(Request $request)
    {
        $data = $request->validate(['code' => ['required', 'string', 'max:100']]);
        $userId = Cache::pull('oauth_code:'.$data['code']);
        $user = $userId ? User::find($userId) : null;
        if (! $user) throw ValidationException::withMessages(['code' => 'That sign-in link has expired. Please try again.']);
        $user = app(AccountStatusService::class)->liftIfExpired($user);
        if ($user->isBlocked()) {
            return response()->json(['message' => $user->blockMessage(), 'code' => 'account_blocked', 'block' => $user->blockInfo()], 403);
        }
        $user->update(['last_login_at' => now()]);
        return response()->json(['token' => $user->createToken('web')->plainTextToken, 'user' => Present::user($user)]);
    }

    /** Finish a sign-up where the provider gave us no email. */
    public function complete(Request $request)
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:120'],
        ]);
        $pending = Cache::get('oauth_pending:'.$data['code']);
        if (! $pending) throw ValidationException::withMessages(['code' => 'That sign-in has expired. Please start again.']);
        $email = strtolower($data['email']);
        if (User::where('email', $email)->exists()) {
            throw ValidationException::withMessages(['email' => 'An account with this email already exists. Log in with your password, or use a different email.']);
        }
        Cache::forget('oauth_pending:'.$data['code']);
        $user = $this->createUser($pending['name'] ?? null, $email, false);
        SocialAccount::create(['user_id' => $user->id, 'provider' => $pending['provider'], 'provider_user_id' => $pending['pid']]);
        $this->welcome($user);
        $user->update(['last_login_at' => now()]);
        return response()->json(['token' => $user->createToken('web')->plainTextToken, 'user' => Present::user($user)], 201);
    }

    protected function issueCode(User $user): string
    {
        $code = Str::random(48);
        Cache::put("oauth_code:{$code}", $user->id, now()->addMinutes(2));
        return $code;
    }

    protected function createUser(?string $name, string $email, bool $verified): User
    {
        $base = Str::of(Str::before($email, '@'))->replaceMatches('/[^A-Za-z0-9_]/', '')->limit(20, '')->value() ?: 'rider';
        $username = $base;
        while (User::where('username', $username)->exists()) $username = $base.random_int(10, 9999);
        return User::create([
            'name' => $name ?: $base,
            'username' => $username,
            'email' => $email,
            'email_verified_at' => $verified ? now() : null,
            'role' => 'renter',
            'last_login_at' => now(),
        ]);
    }

    protected function welcome(User $user): void
    {
        Notifier::send($user, 'Welcome to ByaheGo!', 'Complete your profile and verify your driver\'s license once to book self-drive trips.', '/verify', 'success');
    }
}
