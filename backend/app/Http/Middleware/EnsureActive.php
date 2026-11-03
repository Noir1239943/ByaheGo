<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsureActive
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();
        if ($user && $user->isSuspended()) {
            $user->currentAccessToken()?->delete();
            return response()->json([
                'message' => 'Your account is on hold. Please contact support@byahego.ph for help.',
                'code' => 'account_suspended',
            ], 403);
        }
        return $next($request);
    }
}
