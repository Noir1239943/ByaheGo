<?php

namespace Tests\Feature;

use Tests\TestCase;

class AuthTest extends TestCase
{
    public function test_login_with_username_or_email(): void
    {
        $u = $this->makeUser(['username' => 'Test123', 'email' => 'test123@example.test']);
        $this->postJson('/api/auth/login', ['login' => 'Test123', 'password' => 'Password123'])->assertOk()->assertJsonStructure(['token', 'user' => ['id', 'username', 'role']]);
        $this->postJson('/api/auth/login', ['login' => 'test123@example.test', 'password' => 'Password123'])->assertOk()->assertJsonPath('user.username', 'Test123');
        $this->postJson('/api/auth/login', ['login' => 'Test123', 'password' => 'wrong'])->assertStatus(422)->assertJsonValidationErrors('login');
    }

    public function test_register_and_me(): void
    {
        $res = $this->postJson('/api/auth/register', [
            'name' => 'Juan Dela Cruz', 'username' => 'juandc', 'email' => 'juan@example.test', 'phone' => '09170000000',
            'password' => 'secret123', 'password_confirmation' => 'secret123',
        ])->assertCreated()->assertJsonPath('user.verification_status', 'unverified')->assertJsonPath('user.status', 'active');
        $this->withHeader('Authorization', 'Bearer '.$res->json('token'))->getJson('/api/me')->assertOk()->assertJsonPath('user.username', 'juandc')
            ->assertJsonPath('unread_notifications', 1);
        $this->guest()->postJson('/api/auth/register', ['name' => 'X', 'username' => 'juandc', 'email' => 'juan@example.test', 'password' => 'short', 'password_confirmation' => 'nope'])
            ->assertStatus(422)->assertJsonValidationErrors(['username', 'email', 'password']);
    }

    public function test_protected_routes_need_a_token(): void
    {
        $this->getJson('/api/me')->assertStatus(401)->assertJsonPath('message', 'Please sign in to continue.');
    }

    public function test_suspended_user_cannot_log_in_or_use_old_token(): void
    {
        $u = $this->makeUser();
        $token = $u->createToken('t')->plainTextToken;
        $u->update(['status' => 'suspended', 'suspended_reason' => 'Fraud review']);
        $this->postJson('/api/auth/login', ['login' => $u->username, 'password' => 'Password123'])->assertStatus(403)->assertJsonPath('block.reason', 'Fraud review');
        $this->withHeader('Authorization', 'Bearer '.$token)->getJson('/api/me')->assertStatus(403)->assertJsonPath('code', 'account_blocked');
    }

    public function test_profile_and_password_update(): void
    {
        $u = $this->makeUser();
        $this->as($u)->putJson('/api/me', ['name' => 'New Name', 'email' => $u->email, 'phone' => '0999', 'city' => 'Cordova'])->assertOk()->assertJsonPath('user.city', 'Cordova');
        $this->as($u)->putJson('/api/me/password', ['current_password' => 'bad', 'password' => 'NewPass123', 'password_confirmation' => 'NewPass123'])->assertStatus(422);
        $this->as($u)->putJson('/api/me/password', ['current_password' => 'Password123', 'password' => 'NewPass123', 'password_confirmation' => 'NewPass123'])->assertOk();
        $this->guest()->postJson('/api/auth/login', ['login' => $u->username, 'password' => 'NewPass123'])->assertOk();
    }
}
