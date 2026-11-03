<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\Notifier;
use App\Support\Present;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'username' => ['required', 'string', 'min:4', 'max:30', 'alpha_dash', 'unique:users,username'],
            'email' => ['required', 'email', 'max:120', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:20'],
            'password' => ['required', 'confirmed', Password::min(8)->letters()->numbers()],
        ], [
            'username.unique' => 'That username is taken. Try another one.',
            'email.unique' => 'An account with this email already exists. Try signing in instead.',
        ]);

        $user = User::create($data + ['role' => 'renter', 'last_login_at' => now()]);
        Notifier::send($user, 'Welcome to ByaheGo!', 'Verify your driver\'s license once and book self-drive trips in minutes.', '/verify', 'success');

        return response()->json(['token' => $user->createToken('web')->plainTextToken, 'user' => Present::user($user)], 201);
    }

    public function login(Request $request)
    {
        $data = $request->validate([
            'login' => ['required', 'string'],
            'password' => ['required', 'string'],
        ], ['login.required' => 'Enter your username or email.']);

        $login = trim($data['login']);
        $user = User::where('email', strtolower($login))->orWhere('username', $login)->first();
        if (! $user || ! $user->password || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['login' => 'Incorrect username/email or password.']);
        }
        if ($user->isSuspended()) {
            throw ValidationException::withMessages(['login' => 'Your account is on hold'.($user->suspended_reason ? " ({$user->suspended_reason})" : '').'. Please contact support.']);
        }
        $user->update(['last_login_at' => now()]);

        return response()->json(['token' => $user->createToken('web')->plainTextToken, 'user' => Present::user($user)]);
    }

    /** Sign in with Google: verifies the ID token from Google Identity Services. */
    public function google(Request $request)
    {
        $data = $request->validate(['credential' => ['required', 'string']]);
        $clientId = config('services.google.client_id');
        if (! $clientId) {
            throw ValidationException::withMessages(['credential' => 'Google sign-in isn\'t set up yet. Please use your username and password.']);
        }
        $res = Http::timeout(10)->get('https://oauth2.googleapis.com/tokeninfo', ['id_token' => $data['credential']]);
        $info = $res->json();
        if (! $res->ok() || ($info['aud'] ?? null) !== $clientId || ! in_array($info['iss'] ?? '', ['accounts.google.com', 'https://accounts.google.com'], true)
            || ($info['email_verified'] ?? 'false') !== 'true' && ($info['email_verified'] ?? false) !== true) {
            throw ValidationException::withMessages(['credential' => 'We couldn\'t verify your Google account. Please try again.']);
        }

        $email = strtolower($info['email']);
        $user = User::where('google_id', $info['sub'])->orWhere('email', $email)->first();
        if (! $user) {
            $base = Str::of(Str::before($email, '@'))->replaceMatches('/[^A-Za-z0-9_]/', '')->limit(20, '')->value() ?: 'rider';
            $username = $base;
            while (User::where('username', $username)->exists()) $username = $base.random_int(10, 9999);
            $user = User::create([
                'name' => $info['name'] ?? $base,
                'username' => $username,
                'email' => $email,
                'google_id' => $info['sub'],
                'email_verified_at' => now(),
                'role' => 'renter',
            ]);
            Notifier::send($user, 'Welcome to ByaheGo!', 'Verify your driver\'s license once and book self-drive trips in minutes.', '/verify', 'success');
        } elseif (! $user->google_id) {
            $user->update(['google_id' => $info['sub']]);
        }
        if ($user->isSuspended()) {
            throw ValidationException::withMessages(['credential' => 'Your account is on hold. Please contact support.']);
        }
        $user->update(['last_login_at' => now()]);

        return response()->json(['token' => $user->createToken('web')->plainTextToken, 'user' => Present::user($user)]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()?->delete();
        return response()->json(['message' => 'Signed out.']);
    }

    public function config()
    {
        return response()->json(['google_enabled' => (bool) config('services.google.client_id')]);
    }
}
