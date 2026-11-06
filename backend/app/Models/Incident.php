<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Incident extends Model
{
    protected $fillable = ['booking_id', 'reporter_id', 'type', 'description', 'amount_claimed', 'photo_ids', 'pins', 'lat', 'lng', 'status',
        'amount_approved', 'resolution_notes', 'resolved_by', 'resolved_at'];
    protected $attributes = ['status' => 'open', 'amount_claimed' => 0, 'amount_approved' => 0];
    protected $casts = ['photo_ids' => 'array', 'pins' => 'array', 'lat' => 'float', 'lng' => 'float', 'resolved_at' => 'datetime'];

    public function booking(): BelongsTo { return $this->belongsTo(Booking::class); }
    public function reporter(): BelongsTo { return $this->belongsTo(User::class, 'reporter_id'); }
}
