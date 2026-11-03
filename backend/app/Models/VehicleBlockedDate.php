<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VehicleBlockedDate extends Model
{
    protected $fillable = ['vehicle_id', 'starts_on', 'ends_on', 'reason'];

    protected $casts = ['starts_on' => 'date', 'ends_on' => 'date'];

    public function vehicle(): BelongsTo { return $this->belongsTo(Vehicle::class); }
}
