<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RecentlyViewed extends Model
{
    protected $table = 'recently_viewed';
    public $timestamps = false;
    protected $fillable = ['user_id', 'vehicle_id', 'viewed_at'];
    protected $casts = ['viewed_at' => 'datetime'];

    public function vehicle(): BelongsTo { return $this->belongsTo(Vehicle::class); }
}
