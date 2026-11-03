<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payout extends Model
{
    protected $fillable = ['host_id', 'booking_id', 'amount', 'status', 'scheduled_for', 'paid_at', 'reference'];
    protected $casts = ['scheduled_for' => 'date', 'paid_at' => 'datetime'];

    public function host(): BelongsTo { return $this->belongsTo(User::class, 'host_id'); }
    public function booking(): BelongsTo { return $this->belongsTo(Booking::class); }
}
