<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Measures every request: total time, number of database queries and time spent in them.
 * Off unless PERF_LOG=true (PERF_LOG=sql also lists every query in storage/logs/perf-sql.log). One tab-separated line per request goes to storage/logs/perf.log
 * (and the numbers are sent back as X-Perf headers so the browser's network tab shows them too).
 */
class PerfLog
{
    public function handle(Request $request, Closure $next)
    {
        if (! config('app.perf_log')) {
            return $next($request);
        }
        $start = microtime(true);
        $count = 0;
        $dbMs = 0.0;
        $sql = [];
        $trace = config('app.perf_log') === 'sql';
        DB::listen(function ($q) use (&$count, &$dbMs, &$sql, $trace) {
            $count++;
            $dbMs += $q->time;
            if ($trace) $sql[] = sprintf('%5.0fms  %s', $q->time, preg_replace('/\s+/', ' ', $q->sql));
        });
        $response = $next($request);

        $total = (microtime(true) - $start) * 1000;
        $route = $request->route()?->uri() ?? $request->path();
        if ($trace) {
            @file_put_contents(storage_path('logs/perf-sql.log'), "== {$request->method()} /{$request->path()}
".implode("
", $sql)."

", FILE_APPEND | LOCK_EX);
        }
        $response->headers->set('X-Perf', sprintf('%.0fms; db=%d queries %.0fms', $total, $count, $dbMs));
        @file_put_contents(
            storage_path('logs/perf.log'),
            implode("\t", [$request->method(), $route, $response->getStatusCode(), round($total), $count, round($dbMs)])."\n",
            FILE_APPEND | LOCK_EX,
        );
        return $response;
    }
}
