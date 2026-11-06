<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BookingAgreement extends Model
{
    protected $guarded = ['id'];

    protected $casts = ['signed_at' => 'datetime', 'read_to_end' => 'boolean'];

    public function booking(): BelongsTo { return $this->belongsTo(Booking::class); }
}
