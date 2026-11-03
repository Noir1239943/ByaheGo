<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name', 'username', 'email', 'phone', 'password', 'google_id', 'role', 'status', 'suspended_reason',
        'suspended_at', 'verification_status', 'city', 'payout_method', 'payout_account_name',
        'payout_account_number', 'notify_email', 'notify_sms', 'last_login_at', 'email_verified_at',
    ];

    protected $hidden = ['password', 'remember_token', 'google_id'];

    protected $casts = ['is_super_admin' => 'boolean'];

    protected $attributes = [
        'role' => 'renter',
        'status' => 'active',
        'verification_status' => 'unverified',
        'notify_email' => true,
        'notify_sms' => false,
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'suspended_at' => 'datetime',
            'last_login_at' => 'datetime',
            'notify_email' => 'boolean',
            'notify_sms' => 'boolean',
            'password' => 'hashed',
        ];
    }

    public function isAdmin(): bool { return $this->role === 'admin'; }
    public function isHost(): bool { return $this->role === 'host'; }
    public function isSuspended(): bool { return $this->status === 'suspended'; }
    public function isVerified(): bool { return $this->verification_status === 'verified'; }

    public function vehicles(): HasMany { return $this->hasMany(Vehicle::class, 'host_id'); }
    public function bookings(): HasMany { return $this->hasMany(Booking::class, 'renter_id'); }
    public function hostBookings(): HasMany { return $this->hasMany(Booking::class, 'host_id'); }
    public function licenses(): HasMany { return $this->hasMany(DriverLicense::class); }
    public function latestLicense(): HasOne { return $this->hasOne(DriverLicense::class)->latestOfMany(); }
    public function hostApplication(): HasOne { return $this->hasOne(HostApplication::class)->latestOfMany(); }
    public function favorites(): HasMany { return $this->hasMany(Favorite::class); }
    public function notificationsFeed(): HasMany { return $this->hasMany(UserNotification::class); }
    public function payments(): HasMany { return $this->hasMany(Payment::class); }

    public function maskedPayoutAccount(): ?string
    {
        if (! $this->payout_account_number) return null;
        $digits = preg_replace('/\D/', '', $this->payout_account_number);
        return '•••• '.substr($digits, -4);
    }
}
