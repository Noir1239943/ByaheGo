<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Payment extends Model
{
    /** Payment types that bring money in from the renter (everything refundable and invoiced). */
    public const MONEY_IN = ['charge', 'balance', 'extension'];

    protected $fillable = [
        'booking_id', 'parent_id', 'user_id', 'type', 'method', 'provider', 'amount', 'status', 'receipt_no', 'gateway_ref',
        'provider_session_id', 'checkout_url', 'provider_payment_id', 'provider_refund_id', 'account_hint', 'description', 'items', 'reason',
        'requested_by', 'processed_by', 'failure_reason', 'attempts', 'paid_at',
    ];

    protected function casts(): array
    {
        return ['items' => 'array', 'paid_at' => 'datetime'];
    }

    public function booking(): BelongsTo { return $this->belongsTo(Booking::class); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function parent(): BelongsTo { return $this->belongsTo(self::class, 'parent_id'); }
    public function requester(): BelongsTo { return $this->belongsTo(User::class, 'requested_by'); }
    public function invoice(): HasOne { return $this->hasOne(Invoice::class); }

    /** Money that really came in from the renter (an online payment that went through). */
    public function isMoneyIn(): bool { return in_array($this->type, self::MONEY_IN, true) && $this->status === 'succeeded'; }
}
