<?php

namespace App\Support;

class Protection
{
    /** Protection plans offered at checkout. liability_cap = most the renter pays for accidental damage. */
    public const PLANS = [
        'standard' => [
            'key' => 'standard', 'name' => 'Standard protection', 'price_per_day' => 0, 'liability_cap' => 20000,
            'summary' => 'Included in every trip. You pay up to ₱20,000 if the car is accidentally damaged.',
        ],
        'plus' => [
            'key' => 'plus', 'name' => 'Plus protection', 'price_per_day' => 250, 'liability_cap' => 8000,
            'summary' => 'Lower your share of accidental damage to ₱8,000. Includes free towing anywhere in Cebu.',
        ],
        'premium' => [
            'key' => 'premium', 'name' => 'Premium protection', 'price_per_day' => 450, 'liability_cap' => 2500,
            'summary' => 'Worry-free: pay at most ₱2,500 for accidental damage, plus tire and windshield cover.',
        ],
    ];

    public static function get(string $key): array
    {
        return static::PLANS[$key] ?? static::PLANS['standard'];
    }
}
