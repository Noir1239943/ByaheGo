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
        'expires_at' => 'datetime',
        'checkout_submitted_at' => 'datetime',
        'host_review_due_at' => 'datetime',
        'return_reminder_sent_at' => 'datetime',
        'pickup_lat' => 'float',
        'pickup_lng' => 'float',
    ];

    public function renter(): BelongsTo { return $this->belongsTo(User::class, 'renter_id'); }
    public function host(): BelongsTo { return $this->belongsTo(User::class, 'host_id'); }
    public function vehicle(): BelongsTo { return $this->belongsTo(Vehicle::class); }
    public function payments(): HasMany { return $this->hasMany(Payment::class)->orderBy('id'); }
    public function events(): HasMany { return $this->hasMany(BookingEvent::class)->orderByDesc('id'); }
    public function inspections(): HasMany { return $this->hasMany(Inspection::class)->orderBy('id'); }
    public function inspectionPhotos(): HasMany { return $this->hasMany(InspectionPhoto::class)->orderBy('id'); }
    public function extensions(): HasMany { return $this->hasMany(BookingExtension::class)->orderByDesc('id'); }
    public function incidents(): HasMany { return $this->hasMany(Incident::class)->orderByDesc('id'); }
    public function review(): HasOne { return $this->hasOne(Review::class); }
    public function payout(): HasOne { return $this->hasOne(Payout::class); }
    public function agreement(): HasOne { return $this->hasOne(BookingAgreement::class); }

    /** Bookings that block a vehicle's calendar: confirmed or active ones, and unpaid pending ones until their hold runs out. */
    public function scopeBlocking(Builder $q): Builder
    {
        return $q->where(fn ($w) => $w->whereIn('status', ['confirmed', 'active'])
            ->orWhere(fn ($p) => $p->where('status', 'pending')->where('expires_at', '>', now())));
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
