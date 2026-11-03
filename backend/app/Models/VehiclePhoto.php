<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VehiclePhoto extends Model
{
    protected $fillable = ['vehicle_id', 'media_id', 'position'];

    public function media(): BelongsTo { return $this->belongsTo(Media::class); }
}
