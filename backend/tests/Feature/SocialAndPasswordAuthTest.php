<?php

namespace Tests\Feature;

use App\Models\SocialAccount;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\RateLimiter;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialUser;
use Tests\TestCase;

class SocialAndPasswordAuthTest extends TestCase
{
    protected function configureProviders(): void
    {
        config([
            'services.google.client_id' => 'g-id', 'services.google.client_secret' => 'g-secret',
            'services.facebook.client_id' => 'f-id', 'services.facebook.client_secret' => 'f-secret',
            'app.frontend_url' => 'https://app.test',
        ]);
    }

    protected function fakeProviderUser(string $id, ?string $email, ?string $name, array $raw = []): void
    {
        $user = (new SocialUser)->map(['id' => $id, 'email' => $email, 'name' => $name])->setRaw($raw);
        // A stand-in for the provider driver. It also builds a redirect, so starting another flow while it is installed works.
        $driver = new class($user) {
            public array $params = [];

            public function __construct(public SocialUser $user) {}

            public function stateless() { return $this; }

            public function with(array $params) { $this->params = $params; return $this; }

            public function redirect() { return redirect()->away('https://provider.test/auth?'.http_build_query($this->params)); }

            public function user() { return $this->user; }
        };
        Socialite::swap(new class($driver) {
            public function __construct(public object $driver) {}

            public function driver() { return $this->driver; }
        });
    }

    /** Starts the flow for real to get a valid state value. */
    protected function startFlow(string $provider): string
    {
        $location = $this->get("/api/auth/{$provider}/redirect")->assertRedirect()->headers->get('Location');
        parse_str(parse_url($location, PHP_URL_QUERY), $q);
        return $q['state'];
    }

    protected function codeFrom($response): string
    {
        parse_str(parse_url($response->headers->get('Location'), PHP_URL_QUERY), $q);
        return $q['code'];
    }

    public function test_config_only_enables_providers_with_keys(): void
    {
        $this->getJson('/api/auth/config')->assertOk()->assertJson(['google_enabled' => false, 'facebook_enabled' => false]);
        config(['services.google.client_id' => 'x', 'services.google.client_secret' => 'y']);
        $this->getJson('/api/auth/config')->assertJson(['google_enabled' => true, 'facebook_enabled' => false]);
        $this->get('/api/auth/facebook/redirect')->assertRedirect('http://localhost:5173/auth/callback?error=not_configured');
    }

    public function test_google_flow_creates_account_and_code_is_single_use(): void
    {
        $this->configureProviders();
        $state = $this->startFlow('google');
        $this->fakeProviderUser('g-1', 'Maria.Santos@gmail.com', 'Maria Santos', ['email_verified' => true]);

        $res = $this->get('/api/auth/google/callback?state='.$state)->assertRedirectContains('https://app.test/auth/callback?code=');
        $code = $this->codeFrom($res);
        $this->assertStringNotContainsString('token', $res->headers->get('Location'));

        $this->postJson('/api/auth/social/exchange', ['code' => $code])->assertOk()
            ->assertJsonPath('user.email', 'maria.santos@gmail.com')->assertJsonPath('user.google_linked', true)->assertJsonStructure(['token']);
        $this->postJson('/api/auth/social/exchange', ['code' => $code])->assertStatus(422); // one-time
        $this->assertDatabaseCount('social_accounts', 1);

        // Signing in again reuses the same account.
        $state = $this->startFlow('google');
        $this->get('/api/auth/google/callback?state='.$state)->assertRedirectContains('/auth/callback?code=');
        $this->assertDatabaseCount('users', 1);
    }

    public function test_callback_rejects_a_missing_or_reused_state(): void
    {
        $this->configureProviders();
        $this->fakeProviderUser('g-1', 'a@b.test', 'A', ['email_verified' => true]);
        $this->get('/api/auth/google/callback')->assertRedirect('https://app.test/auth/callback?error=invalid_state');
        $state = $this->startFlow('google');
        $this->get('/api/auth/google/callback?state='.$state)->assertRedirectContains('code=');
        $this->get('/api/auth/google/callback?state='.$state)->assertRedirect('https://app.test/auth/callback?error=invalid_state');
        $other = $this->startFlow('google');
        $this->get('/api/auth/facebook/callback?state='.$other)->assertRedirect('https://app.test/auth/callback?error=invalid_state'); // state is tied to its provider
    }

    public function test_links_to_existing_account_only_when_email_is_verified(): void
    {
        $this->configureProviders();
        $existing = $this->makeUser(['email' => 'juan@example.test']);

        $this->fakeProviderUser('g-2', 'juan@example.test', 'Juan', ['email_verified' => false]);
        $this->get('/api/auth/google/callback?state='.$this->startFlow('google'))->assertRedirect('https://app.test/auth/callback?error=email_in_use');
        $this->assertDatabaseCount('social_accounts', 0);

        $this->fakeProviderUser('g-2', 'juan@example.test', 'Juan', ['email_verified' => true]);
        $res = $this->get('/api/auth/google/callback?state='.$this->startFlow('google'))->assertRedirectContains('code=');
        $this->assertSame($existing->id, SocialAccount::first()->user_id);
        $this->postJson('/api/auth/social/exchange', ['code' => $this->codeFrom($res)])->assertOk()->assertJsonPath('user.id', $existing->id);
    }

    public function test_facebook_without_email_asks_for_one(): void
    {
        $this->configureProviders();
        $this->fakeProviderUser('fb-1', null, 'Pedro Cruz');
        $res = $this->get('/api/auth/facebook/callback?state='.$this->startFlow('facebook'))->assertRedirectContains('need_email=1');
        $code = $this->codeFrom($res);

        $this->makeUser(['email' => 'taken@example.test']);
        $this->postJson('/api/auth/social/complete', ['code' => $code, 'email' => 'taken@example.test'])->assertStatus(422)->assertJsonValidationErrors('email');
        $this->postJson('/api/auth/social/complete', ['code' => $code, 'email' => 'pedro@example.test'])->assertCreated()
            ->assertJsonPath('user.email', 'pedro@example.test')->assertJsonPath('user.facebook_linked', true);
        $this->assertNull(User::where('email', 'pedro@example.test')->first()->email_verified_at); // typed in by hand, not confirmed
        $this->postJson('/api/auth/social/complete', ['code' => $code, 'email' => 'again@example.test'])->assertStatus(422); // single use
    }

    public function test_blocked_person_signing_in_with_a_provider_is_told_why(): void
    {
        $this->configureProviders();
        $u = $this->makeUser(['email' => 'blocked@example.test']);
        $this->fakeProviderUser('g-9', 'blocked@example.test', 'Blocked Person', ['email_verified' => true]);
        $res = $this->get('/api/auth/google/callback?state='.$this->startFlow('google'))->assertRedirectContains('code=');
        $u->update(['status' => 'revoked', 'suspended_reason' => 'Fraud']);
        $this->postJson('/api/auth/social/exchange', ['code' => $this->codeFrom($res)])->assertStatus(403)
            ->assertJsonPath('code', 'account_blocked')->assertJsonPath('block.reason', 'Fraud')->assertJsonPath('block.type', 'revoked');
    }

    public function test_both_buttons_show_when_both_providers_have_keys(): void
    {
        $this->configureProviders();
        $this->getJson('/api/auth/config')->assertJson(['google_enabled' => true, 'facebook_enabled' => true]);
        $this->fakeProviderUser('g-1', 'a@b.test', 'A');
        $this->get('/api/auth/google/redirect')->assertRedirectContains('https://provider.test/auth?state=');
        $this->get('/api/auth/facebook/redirect')->assertRedirectContains('https://provider.test/auth?state=');
    }

    public function test_cancelling_at_google_or_facebook_shows_a_clear_message(): void
    {
        $this->configureProviders();
        $this->fakeProviderUser('g-1', 'a@b.test', 'A', ['email_verified' => true]);
        // What Google and Facebook send back when the person presses Cancel.
        $this->get('/api/auth/google/callback?error=access_denied&state='.$this->startFlow('google'))
            ->assertRedirect('https://app.test/auth/callback?error=cancelled');
        $this->get('/api/auth/facebook/callback?error=access_denied&error_code=200&error_reason=user_denied&state='.$this->startFlow('facebook'))
            ->assertRedirect('https://app.test/auth/callback?error=cancelled');
        // Any other error from the provider is not the person's doing.
        $this->get('/api/auth/facebook/callback?error=server_error&state='.$this->startFlow('facebook'))
            ->assertRedirect('https://app.test/auth/callback?error=provider_error');
        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('social_accounts', 0);
    }

    public function test_a_failed_token_exchange_with_the_provider_is_reported(): void
    {
        $this->configureProviders();
        $this->fakeProviderUser('g-1', 'a@b.test', 'A');
        $state = $this->startFlow('google');
        Socialite::swap(new class {
            public function driver()
            {
                return new class {
                    public function stateless() { return $this; }

                    public function user() { throw new \RuntimeException('invalid_grant'); }
                };
            }
        });
        $this->get('/api/auth/google/callback?code=expired&state='.$state)->assertRedirect('https://app.test/auth/callback?error=provider_error');
        $this->assertDatabaseCount('users', 0);
    }

    public function test_facebook_signs_in_to_the_existing_account_with_the_same_email(): void
    {
        $this->configureProviders();
        $existing = $this->makeUser(['email' => 'ana.reyes@example.test']);
        $this->fakeProviderUser('fb-7', 'Ana.Reyes@Example.test', 'Ana Reyes');
        $res = $this->get('/api/auth/facebook/callback?code=ok&state='.$this->startFlow('facebook'))->assertRedirectContains('code=');
        $this->postJson('/api/auth/social/exchange', ['code' => $this->codeFrom($res)])->assertOk()
            ->assertJsonPath('user.id', $existing->id)->assertJsonPath('user.facebook_linked', true)->assertJsonPath('user.google_linked', false);
        $this->assertDatabaseCount('users', 1); // no duplicate account

        // Next time the same Facebook account comes straight back to it.
        $res = $this->get('/api/auth/facebook/callback?code=ok&state='.$this->startFlow('facebook'))->assertRedirectContains('code=');
        $this->postJson('/api/auth/social/exchange', ['code' => $this->codeFrom($res)])->assertOk()->assertJsonPath('user.id', $existing->id);
        $this->assertDatabaseCount('social_accounts', 1);
    }

    public function test_login_is_limited_to_five_attempts_a_minute(): void
    {
        RateLimiter::clear('x');
        $u = $this->makeUser();
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/login', ['login' => $u->username, 'password' => 'wrong-pass'])->assertStatus(422);
        }
        $this->postJson('/api/auth/login', ['login' => $u->username, 'password' => 'Password123'])->assertStatus(429)
            ->assertJsonPath('errors.login.0', fn ($m) => str_contains($m, 'Too many login attempts. Please wait'));
    }

    public function test_password_reset_flow(): void
    {
        Notification::fake();
        $u = $this->makeUser(['email' => 'reset@example.test']);

        $same = $this->postJson('/api/auth/forgot-password', ['email' => 'reset@example.test'])->assertOk()->json('message');
        $this->assertSame($same, $this->postJson('/api/auth/forgot-password', ['email' => 'nobody@example.test'])->json('message')); // no account enumeration

        $token = null;
        Notification::assertSentTo($u, ResetPassword::class, function ($n) use ($u, &$token) {
            $token = $n->token;
            $url = call_user_func(ResetPassword::$createUrlCallback, $u, $n->token);
            $this->assertStringStartsWith('http://localhost:5173/reset-password?token=', $url);
            return true;
        });

        $this->postJson('/api/auth/reset-password', ['token' => 'bad', 'email' => 'reset@example.test', 'password' => 'BrandNew123', 'password_confirmation' => 'BrandNew123'])->assertStatus(422);
        $old = $u->createToken('old')->plainTextToken;
        $this->postJson('/api/auth/reset-password', ['token' => $token, 'email' => 'reset@example.test', 'password' => 'BrandNew123', 'password_confirmation' => 'BrandNew123'])->assertOk();
        $this->postJson('/api/auth/login', ['login' => 'reset@example.test', 'password' => 'BrandNew123'])->assertOk();
        $this->assertSame(0, $u->tokens()->where('name', 'old')->count()); // signed out everywhere
        Cache::flush();
    }
}
