<?php

namespace App\Services;

use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Payment gateway in test mode. It behaves like an e-wallet / card processor (GCash, Maya, cards,
 * Google Pay, Apple Pay) without moving real money, so the full checkout, receipt and refund flows work.
 * Swap this class for a live provider (e.g. PayMongo) when you have merchant keys.
 */
class PaymentGateway
{
    public const METHODS = [
        'gcash' => 'GCash',
        'maya' => 'Maya',
        'card' => 'Credit or debit card',
        'google_pay' => 'Google Pay',
        'apple_pay' => 'Apple Pay',
    ];

    /** Test cards that simulate a decline. */
    public const DECLINED_CARDS = ['4000000000000002', '4000000000009995'];

    public function charge(string $method, int $amount, array $details): array
    {
        if (! array_key_exists($method, self::METHODS)) {
            throw ValidationException::withMessages(['payment_method' => 'Please choose a payment method.']);
        }
        $hint = null;
        if ($method === 'card') {
            $number = preg_replace('/\D/', '', (string) ($details['card_number'] ?? ''));
            $exp = (string) ($details['card_expiry'] ?? '');
            $cvc = preg_replace('/\D/', '', (string) ($details['card_cvc'] ?? ''));
            if (strlen($number) < 13 || strlen($number) > 19 || ! $this->luhn($number)) {
                throw ValidationException::withMessages(['card_number' => 'That card number doesn\'t look right. Please check it and try again.']);
            }
            if (! preg_match('/^(0[1-9]|1[0-2])\s*\/\s*(\d{2})$/', $exp, $m) || (2000 + (int) $m[2]) * 100 + (int) $m[1] < (int) now()->format('Ym')) {
                throw ValidationException::withMessages(['card_expiry' => 'Please enter a valid expiry date (MM/YY).']);
            }
            if (strlen($cvc) < 3) {
                throw ValidationException::withMessages(['card_cvc' => 'Please enter the 3-digit security code.']);
            }
            if (in_array($number, self::DECLINED_CARDS, true)) {
                throw ValidationException::withMessages(['card_number' => 'Your bank declined this payment. Try another card or pay with GCash or Maya.']);
            }
            $hint = '•••• '.substr($number, -4);
        } elseif (in_array($method, ['gcash', 'maya'], true)) {
            $phone = preg_replace('/\D/', '', (string) ($details['wallet_number'] ?? ''));
            if (! preg_match('/^(09\d{9}|639\d{9})$/', $phone)) {
                throw ValidationException::withMessages(['wallet_number' => 'Enter the 11-digit mobile number linked to your '.self::METHODS[$method].' account (e.g. 0917 123 4567).']);
            }
            $hint = substr($phone, -11, 4).' ••• '.substr($phone, -4);
        } else {
            $hint = self::METHODS[$method];
        }

        return [
            'status' => 'succeeded',
            'gateway_ref' => strtoupper(Str::random(4)).'-'.now()->format('ymdHis').'-'.random_int(100, 999),
            'account_hint' => $hint,
            'amount' => $amount,
        ];
    }

    public function refund(string $method, int $amount): array
    {
        return [
            'status' => 'succeeded',
            'gateway_ref' => 'RF-'.strtoupper(Str::random(6)).'-'.now()->format('ymdHis'),
            'amount' => $amount,
        ];
    }

    protected function luhn(string $number): bool
    {
        $sum = 0;
        $alt = false;
        for ($i = strlen($number) - 1; $i >= 0; $i--) {
            $n = (int) $number[$i];
            if ($alt) { $n *= 2; if ($n > 9) $n -= 9; }
            $sum += $n;
            $alt = ! $alt;
        }
        return $sum % 10 === 0;
    }
}
