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
        'hub_id', 'pickup_address', 'city', 'area', 'lat', 'lng', 'or_media_id', 'cr_media_id', 'ctpl_media_id', 'ctpl_expiry', 'grace_minutes', 'fuel_policy', 'status', 'rejection_reason',
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
    public function blockedDates(): HasMany { return $this->hasMany(VehicleBlockedDate::class)->orderBy('starts_on'); }

    protected static function booted(): void
    {
        // A hub pick-up always carries the hub's own coordinates and city, so searches never need a join.
        static::saving(function (Vehicle $v) {
            if ($v->pickup_type === 'hub' && $v->hub_id && ($hub = Hub::find($v->hub_id))) {
                $v->lat = $hub->lat;
                $v->lng = $hub->lng;
                $v->city = $hub->city;
            }
        });
    }

    public function getNameAttribute(): string
    {
        return trim("{$this->make} {$this->model} {$this->year}");
    }

    /**
     * What a host or admin listing page shows for each car (bookings, earnings, and the host's own totals), added to the
     * same query as columns, instead of four extra queries per car.
     */
    public function scopeWithListStats(Builder $q): Builder
    {
        return $q->with(['hub', 'photos', 'host' => fn ($h) => $h->withCount([
            'vehicles as live_vehicles' => fn ($v) => $v->where('status', 'live'),
            'hostBookings as completed_trips' => fn ($b) => $b->where('status', 'completed'),
        ])])
            ->withCount(['bookings as bookings_total' => fn ($b) => $b->whereIn('status', ['confirmed', 'active', 'completed'])])
            ->withSum(['bookings as earnings_total' => fn ($b) => $b->where('status', 'completed')], 'host_earnings');
    }

    public function scopeLive(Builder $q): Builder
    {
        return $q->where('status', 'live')->whereHas('host', fn ($h) => $h->usable());
    }

    /** Not booked and not switched off by the host for any part of [from, to]. */
    public function scopeFreeBetween(Builder $q, $from, $to): Builder
    {
        return $q->whereDoesntHave('bookings', fn ($b) => $b->blocking()->where('pickup_at', '<', $to)->where('return_at', '>', $from))
            ->whereDoesntHave('blockedDates', fn ($d) => $d->where('starts_on', '<=', $to->toDateString())->where('ends_on', '>=', $from->toDateString()));
    }

    public function isFreeBetween($from, $to): bool
    {
        return ! $this->bookings()->blocking()->where('pickup_at', '<', $to)->where('return_at', '>', $from)->exists()
            && ! $this->blockedDates()->where('starts_on', '<=', $to->toDateString())->where('ends_on', '>=', $from->toDateString())->exists();
    }

    public function scopeOverlapping(Builder $q, $from, $to): Builder
    {
        return $q->whereHas('bookings', fn ($b) => $b->blocking()->where('pickup_at', '<', $to)->where('return_at', '>', $from));
    }

    /** Own-location pins are rounded to ~1 km (0.01 degree) before anyone but the host and a confirmed renter sees them. */
    public const PUBLIC_PIN_DECIMALS = 2;

    public function isOwnPickup(): bool
    {
        return $this->pickup_type !== 'hub' || ! $this->hub_id;
    }

    public function publicLat(): ?float
    {
        return $this->lat === null ? null : ($this->isOwnPickup() ? round($this->lat, self::PUBLIC_PIN_DECIMALS) : $this->lat);
    }

    public function publicLng(): ?float
    {
        return $this->lng === null ? null : ($this->isOwnPickup() ? round($this->lng, self::PUBLIC_PIN_DECIMALS) : $this->lng);
    }

    /** $exact = true gives the full street address (host, admin or a confirmed booking). Otherwise only the area. */
    public function pickupLabel(bool $exact = false): string
    {
        if ($this->pickup_type === 'hub' && $this->hub) {
            return $this->hub->name.', '.$this->hub->city;
        }
        if ($exact) {
            return trim(($this->pickup_address ? $this->pickup_address.', ' : '').($this->city ?? ''), ', ');
        }
        $area = $this->area ?: null;
        return $area && $this->city && stripos($area, (string) $this->city) === false ? "{$area}, {$this->city}" : trim((string) ($area ?: $this->city), ', ');
    }
}
