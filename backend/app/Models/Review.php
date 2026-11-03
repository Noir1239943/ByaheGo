<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Review extends Model
{
    protected $fillable = ['booking_id', 'vehicle_id', 'renter_id', 'rating', 'comment'];

    public function renter(): BelongsTo { return $this->belongsTo(User::class, 'renter_id'); }
    public function vehicle(): BelongsTo { return $this->belongsTo(Vehicle::class); }
}
