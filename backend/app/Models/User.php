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
        'suspended_at', 'suspended_until', 'revoked_at', 'blocked_by', 'verification_status', 'city', 'payout_method', 'payout_account_name',
        'payout_account_number', 'payout_bank', 'notify_email', 'notify_sms', 'last_login_at', 'email_verified_at',
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
            'suspended_until' => 'datetime',
            'revoked_at' => 'datetime',
            'last_login_at' => 'datetime',
            'notify_email' => 'boolean',
            'notify_sms' => 'boolean',
            'password' => 'hashed',
            'payout_account_number' => 'encrypted',
        ];
    }

    public function isAdmin(): bool { return $this->role === 'admin'; }
    public function isHost(): bool { return $this->role === 'host'; }
    /** Revoked (permanent), or suspended and the suspension has not ended yet. */
    public function isBlocked(): bool
    {
        if ($this->status === 'revoked') return true;
        return $this->status === 'suspended' && (! $this->suspended_until || $this->suspended_until->isFuture());
    }

    /** Kept for older call sites: "can't use the platform right now". */
    public function isSuspended(): bool { return $this->isBlocked(); }

    /** What a blocked person is shown at login: why, until when, and how to appeal. */
    public function blockInfo(): array
    {
        return [
            'type' => $this->status === 'revoked' ? 'revoked' : 'suspended',
            'reason' => $this->suspended_reason,
            'until' => $this->status === 'suspended' ? $this->suspended_until?->toIso8601String() : null,
            'appeal_email' => config('app.support_email'),
            'appeal_url' => rtrim(config('app.frontend_url'), '/').'/help#contact',
        ];
    }

    public function blockMessage(): string
    {
        $i = $this->blockInfo();
        $what = $i['type'] === 'revoked' ? 'Your account has been closed' : 'Your account is on hold'.($this->suspended_until ? ' until '.$this->suspended_until->timezone('Asia/Manila')->format('M j, Y') : '');
        return $what.($i['reason'] ? ": {$i['reason']}" : '.').' To appeal, email '.$i['appeal_email'].' with your username and a short explanation.';
    }

    /** Users who can use the platform: active, or whose suspension has ended. Used to hide blocked hosts' listings. */
    public function scopeUsable($q)
    {
        return $q->where(fn ($w) => $w->where('status', 'active')
            ->orWhere(fn ($x) => $x->where('status', 'suspended')->whereNotNull('suspended_until')->where('suspended_until', '<=', now())));
    }
    public function isVerified(): bool { return $this->verification_status === 'verified'; }

    public function socialAccounts(): HasMany { return $this->hasMany(SocialAccount::class); }

    public function vehicles(): HasMany { return $this->hasMany(Vehicle::class, 'host_id'); }
    public function bookings(): HasMany { return $this->hasMany(Booking::class, 'renter_id'); }
    public function hostBookings(): HasMany { return $this->hasMany(Booking::class, 'host_id'); }
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
