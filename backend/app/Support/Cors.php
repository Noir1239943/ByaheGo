<?php

namespace App\Support;

class Cors
{
    /**
     * The sites allowed to call the API from a browser, from the comma-separated CORS_ALLOWED_ORIGINS.
     * "*" (anyone) is fine on a developer's machine but never on a live site: there it is dropped, so a missing or careless
     * setting blocks every other site instead of opening the API to all of them.
     *
     * @return list<string>
     */
    public static function origins(?string $raw, bool $production): array
    {
        $list = array_values(array_filter(array_map('trim', explode(',', (string) ($raw ?? '*')))));
        return $production ? array_values(array_diff($list, ['*'])) : $list;
    }
}
