<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Invoice extends Model
{
    protected $fillable = ['number', 'kind', 'payment_id', 'booking_id', 'parent_id', 'data', 'issued_at'];

    protected function casts(): array
    {
        return ['data' => 'array', 'issued_at' => 'datetime'];
    }

    public function payment(): BelongsTo { return $this->belongsTo(Payment::class); }
    public function booking(): BelongsTo { return $this->belongsTo(Booking::class); }
    public function parent(): BelongsTo { return $this->belongsTo(self::class, 'parent_id'); }
}
