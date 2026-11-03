<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Booking extends Model
{
    protected $guarded = ['id'];

    protected $casts = [
        'pickup_at' => 'datetime',
        'return_at' => 'datetime',
        'actual_pickup_at' => 'datetime',
        'actual_return_at' => 'datetime',
        'agreement_accepted_at' => 'datetime',
        'settled_at' => 'datetime',
        'cancelled_at' => 'datetime',
        'pickup_lat' => 'float',
        'pickup_lng' => 'float',
    ];

    public function renter(): BelongsTo { return $this->belongsTo(User::class, 'renter_id'); }
    public function host(): BelongsTo { return $this->belongsTo(User::class, 'host_id'); }
    public function vehicle(): BelongsTo { return $this->belongsTo(Vehicle::class); }
    public function payments(): HasMany { return $this->hasMany(Payment::class)->orderBy('id'); }
    public function events(): HasMany { return $this->hasMany(BookingEvent::class)->orderByDesc('id'); }
    public function inspections(): HasMany { return $this->hasMany(Inspection::class)->orderBy('id'); }
    public function incidents(): HasMany { return $this->hasMany(Incident::class)->orderByDesc('id'); }
    public function review(): HasOne { return $this->hasOne(Review::class); }
    public function payout(): HasOne { return $this->hasOne(Payout::class); }

    /** Bookings that block a vehicle's calendar. */
    public function scopeBlocking(Builder $q): Builder
    {
        return $q->whereIn('status', ['confirmed', 'active']);
    }

    public function getRouteKeyName(): string
    {
        return 'reference';
    }

    public function log(string $type, string $message, ?int $actorId = null): void
    {
        $this->events()->create(['type' => $type, 'message' => $message, 'actor_id' => $actorId]);
    }
}
