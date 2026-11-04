<?php

namespace App\Support;

use Closure;
use Illuminate\Support\Facades\Cache;

/**
 * Short-lived cache for public, read-only pages (car search, filter options, a car's page, hubs, stats).
 * Anything that can change what these show (a car, a booking, a review, a hub, a host being blocked) calls bump(),
 * which retires every cached copy at once, so a result is never older than the last change. The time limit only
 * covers things that change by themselves, like an unpaid booking's hold running out.
 */
class PublicCache
{
    public const VERSION_KEY = 'public.version';

    public static function version(): string
    {
        return (string) Cache::get(self::VERSION_KEY, '0');
    }

    public static function bump(): void
    {
        Cache::forever(self::VERSION_KEY, (string) hrtime(true));
    }

    public static function remember(string $name, array $params, int $seconds, Closure $build): mixed
    {
        ksort($params);
        return Cache::remember('public.'.$name.'.'.self::version().'.'.md5(json_encode($params)), $seconds, $build);
    }
}
