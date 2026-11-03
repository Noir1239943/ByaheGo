<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Vehicle extends Model
{
    protected $fillable = [
        'host_id', 'make', 'model', 'year', 'type', 'transmission', 'fuel', 'seats', 'color', 'color_hex', 'plate_number',
        'description', 'features', 'daily_rate', 'weekly_rate', 'with_driver_available', 'driver_fee_per_day', 'instant_book',
        'delivery_available', 'delivery_fee', 'pet_friendly', 'min_days', 'security_deposit', 'late_fee_per_hour', 'pickup_type',
        'hub_id', 'pickup_address', 'city', 'lat', 'lng', 'or_media_id', 'cr_media_id', 'ctpl_media_id', 'ctpl_expiry', 'grace_minutes', 'fuel_policy', 'status', 'rejection_reason',
        'submitted_at', 'approved_at', 'rating_avg', 'rating_count', 'trips_count',
    ];

    protected $attributes = [
        'status' => 'draft',
        'pickup_type' => 'hub',
        'instant_book' => true,
        'with_driver_available' => false,
        'delivery_available' => false,
        'pet_friendly' => false,
        'daily_rate' => 0,
        'driver_fee_per_day' => 0,
        'delivery_fee' => 0,
        'min_days' => 1,
        'security_deposit' => 3000,
        'late_fee_per_hour' => 300,
        'color_hex' => '#0D7C6B',
        'rating_avg' => 0,
        'rating_count' => 0,
        'trips_count' => 0,
    ];

    protected $casts = [
        'features' => 'array',
        'with_driver_available' => 'boolean',
        'instant_book' => 'boolean',
        'delivery_available' => 'boolean',
        'pet_friendly' => 'boolean',
        'lat' => 'float',
        'lng' => 'float',
        'rating_avg' => 'float',
        'submitted_at' => 'datetime',
        'approved_at' => 'datetime',
        'ctpl_expiry' => 'date',
    ];

    public function host(): BelongsTo { return $this->belongsTo(User::class, 'host_id'); }
    public function hub(): BelongsTo { return $this->belongsTo(Hub::class); }
    public function photos(): HasMany { return $this->hasMany(VehiclePhoto::class)->orderBy('position'); }
    public function bookings(): HasMany { return $this->hasMany(Booking::class); }
    public function reviews(): HasMany { return $this->hasMany(Review::class); }

    public function getNameAttribute(): string
    {
        return trim("{$this->make} {$this->model} {$this->year}");
    }

    public function scopeLive(Builder $q): Builder
    {
        return $q->where('status', 'live')->whereHas('host', fn ($h) => $h->usable());
    }

    public function scopeOverlapping(Builder $q, $from, $to): Builder
    {
        return $q->whereHas('bookings', fn ($b) => $b->blocking()->where('pickup_at', '<', $to)->where('return_at', '>', $from));
    }

    public function pickupLabel(): string
    {
        if ($this->pickup_type === 'hub' && $this->hub) {
            return $this->hub->name.', '.$this->hub->city;
        }
        return trim(($this->pickup_address ? $this->pickup_address.', ' : '').($this->city ?? ''), ', ');
    }
}
