<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Favorite extends Model
{
    protected $fillable = ['user_id', 'vehicle_id', 'price_alert'];
    protected $casts = ['price_alert' => 'boolean'];

    public function vehicle(): BelongsTo { return $this->belongsTo(Vehicle::class); }
}
