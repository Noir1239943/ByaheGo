<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Inspection extends Model
{
    protected $fillable = ['booking_id', 'stage', 'odometer', 'fuel_level', 'checklist', 'notes', 'photo_ids', 'recorded_by'];
    protected $casts = ['checklist' => 'array', 'photo_ids' => 'array'];

    public function booking(): BelongsTo { return $this->belongsTo(Booking::class); }
}
