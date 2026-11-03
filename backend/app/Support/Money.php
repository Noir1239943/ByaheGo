<?php

namespace App\Support;

class Money
{
    public static function peso(int|float $amount): string
    {
        return '₱'.number_format((float) $amount, 0);
    }
}
