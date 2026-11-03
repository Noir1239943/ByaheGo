<?php

namespace App\Http\Middleware;

use App\Services\AccountStatusService;
use Closure;
use Illuminate\Http\Request;

class EnsureActive
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();
        if ($user) {
            $user = app(AccountStatusService::class)->liftIfExpired($user);
            if ($user->isBlocked()) {
                $user->currentAccessToken()?->delete();
                return response()->json(['message' => $user->blockMessage(), 'code' => 'account_blocked', 'block' => $user->blockInfo()], 403);
            }
        }
        return $next($request);
    }
}
