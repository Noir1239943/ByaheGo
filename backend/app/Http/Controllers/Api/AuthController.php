<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AccountStatusService;
use App\Support\Notifier;
use App\Support\Present;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password as PasswordBroker;
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
        $user = app(AccountStatusService::class)->liftIfExpired($user);
        if ($user->isBlocked()) {
            return response()->json(['message' => $user->blockMessage(), 'code' => 'account_blocked', 'block' => $user->blockInfo()], 403);
        }
        $user->update(['last_login_at' => now()]);

        return response()->json(['token' => $user->createToken('web')->plainTextToken, 'user' => Present::user($user)]);
    }

    /** Always answers the same way, so nobody can use this form to find out which emails have accounts. */
    public function forgotPassword(Request $request)
    {
        $data = $request->validate(['email' => ['required', 'email']], ['email.required' => 'Enter the email you signed up with.', 'email.email' => 'Enter a valid email address.']);
        PasswordBroker::sendResetLink(['email' => strtolower($data['email'])]);
        return response()->json(['message' => 'If an account exists for that email, we\'ve sent a link to reset your password.']);
    }

    public function resetPassword(Request $request)
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'confirmed', Password::min(8)->letters()->numbers()],
        ]);
        $status = PasswordBroker::reset(
            ['email' => strtolower($data['email']), 'password' => $data['password'], 'password_confirmation' => $request->input('password_confirmation'), 'token' => $data['token']],
            function (User $user, string $password) {
                $user->forceFill(['password' => $password])->save();
                $user->tokens()->delete(); // sign out everywhere
            },
        );
        if ($status !== PasswordBroker::PASSWORD_RESET) {
            throw ValidationException::withMessages(['email' => 'This reset link is invalid or has expired. Request a new one.']);
        }
        return response()->json(['message' => 'Your password was updated. You can log in now.']);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()?->delete();
        return response()->json(['message' => 'Signed out.']);
    }

    public function config()
    {
        return response()->json(['google_enabled' => SocialAuthController::enabled('google'), 'facebook_enabled' => SocialAuthController::enabled('facebook')]);
    }
}
