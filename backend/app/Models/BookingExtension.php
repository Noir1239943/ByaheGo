<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BookingExtension extends Model
{
    protected $fillable = ['booking_id', 'previous_return_at', 'requested_return_at', 'status', 'note', 'responded_by', 'responded_at'];

    protected function casts(): array
    {
        return ['previous_return_at' => 'datetime', 'requested_return_at' => 'datetime', 'responded_at' => 'datetime'];
    }

    public function booking(): BelongsTo { return $this->belongsTo(Booking::class); }
}
