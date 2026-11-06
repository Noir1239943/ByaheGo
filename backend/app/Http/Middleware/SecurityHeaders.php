<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/** Headers every API answer carries, so browsers don't guess types, frame the API or leak the address people came from. */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);
        $response->headers->add([
            'X-Content-Type-Options' => 'nosniff',
            'X-Frame-Options' => 'DENY',
            'Referrer-Policy' => 'no-referrer',
            'Permissions-Policy' => 'camera=(), microphone=(), geolocation=(), payment=()',
            'Cross-Origin-Opener-Policy' => 'same-origin',
        ]);
        if ($request->isSecure()) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }
        return $response;
    }
}
