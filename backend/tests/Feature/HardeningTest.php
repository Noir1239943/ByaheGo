<?php

namespace Tests\Feature;

use App\Support\Cors;
use Tests\TestCase;

/** Settings that keep a public deployment safe. */
class HardeningTest extends TestCase
{
    public function test_a_live_site_never_accepts_every_origin(): void
    {
        $this->assertSame(['https://byahego.vercel.app'], Cors::origins('https://byahego.vercel.app', true));
        $this->assertSame(['https://a.example', 'https://b.example'], Cors::origins(' https://a.example , * ,https://b.example', true));
        $this->assertSame([], Cors::origins('*', true), 'A careless "*" blocks other sites instead of opening the API to them.');
        $this->assertSame([], Cors::origins(null, true), 'A missing setting also fails closed.');
        $this->assertSame(['*'], Cors::origins('*', false), 'On a developer machine "*" is fine.');
    }

    public function test_every_api_answer_carries_the_security_headers(): void
    {
        $res = $this->guest()->getJson('/api/stats')->assertOk();
        $this->assertSame('nosniff', $res->headers->get('X-Content-Type-Options'));
        $this->assertSame('DENY', $res->headers->get('X-Frame-Options'));
        $this->assertSame('no-referrer', $res->headers->get('Referrer-Policy'));
        $this->assertStringContainsString('camera=()', $res->headers->get('Permissions-Policy'));
        // Errors carry them too.
        $this->assertSame('nosniff', $this->guest()->getJson('/api/me')->assertUnauthorized()->headers->get('X-Content-Type-Options'));
        $this->assertNull($res->headers->get('Strict-Transport-Security'), 'Only over HTTPS.');
        $secure = $this->guest()->getJson('https://localhost/api/stats');
        $this->assertStringContainsString('max-age=31536000', $secure->headers->get('Strict-Transport-Security'));
    }

    public function test_signing_in_is_limited_per_address_as_well_as_per_account(): void
    {
        $u = $this->verifiedRenter();
        // 20 different account names from one address: the 21st attempt is refused whichever name it uses.
        for ($i = 1; $i <= 20; $i++) {
            $this->guest()->postJson('/api/auth/login', ['login' => "nobody{$i}", 'password' => 'wrong-password'])->assertStatus(422);
        }
        $this->guest()->postJson('/api/auth/login', ['login' => 'nobody21', 'password' => 'wrong-password'])->assertStatus(429)->assertJsonValidationErrors('login');
        $this->guest()->postJson('/api/auth/login', ['login' => $u->username, 'password' => 'Password123'])->assertStatus(429);
    }

    public function test_sign_ins_expire_when_an_expiry_is_configured(): void
    {
        config(['sanctum.expiration' => 60]);
        $u = $this->verifiedRenter();
        $token = $u->createToken('t')->plainTextToken;
        $this->app['auth']->forgetGuards();
        $this->withHeader('Authorization', 'Bearer '.$token)->getJson('/api/me')->assertOk();
        $this->travel(61)->minutes();
        $this->app['auth']->forgetGuards();
        $this->withHeader('Authorization', 'Bearer '.$token)->getJson('/api/me')->assertUnauthorized();
    }
}
