<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/** Small SQL helpers that behave the same on Postgres (production) and SQLite (tests). */
class Sql
{
    /** "2026-11" for a timestamp column, so twelve monthly sums come back from one grouped query. */
    public static function month(string $column): string
    {
        return DB::connection()->getDriverName() === 'pgsql' ? "to_char({$column}, 'YYYY-MM')" : "strftime('%Y-%m', {$column})";
    }

    /** The last twelve months as ['label' => 'Nov', 'month' => '2026-11', 'amount' => n], oldest first, with zero for quiet months. */
    public static function twelveMonths(\Illuminate\Support\Collection $sumsByMonth): \Illuminate\Support\Collection
    {
        return collect(range(11, 0))->map(function ($i) use ($sumsByMonth) {
            $start = now()->startOfMonth()->subMonths($i);
            return ['label' => $start->format('M'), 'month' => $start->format('Y-m'), 'amount' => (int) ($sumsByMonth[$start->format('Y-m')] ?? 0)];
        });
    }
}
