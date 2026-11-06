<?php

namespace App\Support;

use Illuminate\Support\Str;
use InvalidArgumentException;

/**
 * Rules for the demo accounts (renter, host, admin and the sample trips around them).
 *
 * The repository is public, so no demo password lives in it. Locally the seeder makes up a password and prints it. On a live
 * site demo data is OFF unless SEED_DEMO_DATA=true, and then the password must come from the DEMO_PASSWORD environment variable.
 */
class DemoData
{
    public const MIN_PASSWORD_LENGTH = 12;

    /** Demo data is always allowed locally and in tests; in production only when explicitly switched on. */
    public static function allowed(): bool
    {
        return ! app()->environment('production') || (bool) config('app.seed_demo_data');
    }

    /**
     * The password for every demo account. Returns [password, wasGenerated].
     *
     * @return array{0: string, 1: bool}
     */
    public static function password(): array
    {
        $given = (string) config('app.demo_password');
        if ($given !== '') {
            self::assertStrong($given, 'DEMO_PASSWORD');
            return [$given, false];
        }
        if (app()->environment('production')) {
            throw new InvalidArgumentException('SEED_DEMO_DATA is on, so DEMO_PASSWORD must be set (at least '.self::MIN_PASSWORD_LENGTH.' characters).');
        }
        return [Str::password(16, symbols: false), true];
    }

    public static function assertStrong(string $password, string $name): void
    {
        if (mb_strlen($password) < self::MIN_PASSWORD_LENGTH) {
            throw new InvalidArgumentException("{$name} must be at least ".self::MIN_PASSWORD_LENGTH.' characters.');
        }
    }
}
