<?php

namespace App\Support;

class Protection
{
    /**
     * ByaheGo's damage policy (NOT an insurance policy): the plan sets the most a renter pays for accidental damage.
     * It does not cover theft, missing parts, fines or negligence, and it adds no towing, tire or windshield service.
     * liability_cap = most the renter pays for accidental damage.
     */
    public const PLANS = [
        'standard' => [
            'key' => 'standard', 'name' => 'Standard protection', 'price_per_day' => 0, 'liability_cap' => 20000,
            'summary' => 'Included in every trip. If the car is accidentally damaged you pay at most ₱20,000 (your deposit is used first).',
        ],
        'plus' => [
            'key' => 'plus', 'name' => 'Plus protection', 'price_per_day' => 250, 'liability_cap' => 8000,
            'summary' => 'Lowers the most you pay for accidental damage to ₱8,000.',
        ],
        'premium' => [
            'key' => 'premium', 'name' => 'Premium protection', 'price_per_day' => 450, 'liability_cap' => 2500,
            'summary' => 'Lowest share: you pay at most ₱2,500 for accidental damage.',
        ],
    ];

    public static function get(string $key): array
    {
        return static::PLANS[$key] ?? static::PLANS['standard'];
    }
}
