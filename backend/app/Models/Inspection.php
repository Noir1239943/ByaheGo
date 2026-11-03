<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Inspection extends Model
{
    protected $fillable = ['booking_id', 'stage', 'odometer', 'fuel_level', 'checklist', 'notes', 'photo_ids', 'recorded_by', 'submitted_at', 'host_status', 'host_notes', 'host_responded_at'];
    protected $casts = ['checklist' => 'array', 'photo_ids' => 'array', 'submitted_at' => 'datetime', 'host_responded_at' => 'datetime'];

    public function booking(): BelongsTo { return $this->belongsTo(Booking::class); }
    public function photos(): HasMany { return $this->hasMany(InspectionPhoto::class)->orderBy('id'); }
}
