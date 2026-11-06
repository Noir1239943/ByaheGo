<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One photo of a check-in or check-out. Submitted photos are never edited or removed; extra photos can only be added. */
class InspectionPhoto extends Model
{
    protected $fillable = ['booking_id', 'inspection_id', 'stage', 'angle', 'media_id', 'uploader_id', 'live', 'device_time', 'lat', 'lng', 'sha256', 'note'];

    protected function casts(): array
    {
        return ['live' => 'boolean', 'device_time' => 'datetime', 'lat' => 'float', 'lng' => 'float'];
    }

    public function booking(): BelongsTo { return $this->belongsTo(Booking::class); }
    public function inspection(): BelongsTo { return $this->belongsTo(Inspection::class); }
    public function uploader(): BelongsTo { return $this->belongsTo(User::class, 'uploader_id'); }
    public function media(): BelongsTo { return $this->belongsTo(Media::class); }
}
