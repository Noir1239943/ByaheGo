<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Audit record of an automatic ID decision or a super-admin override. Append-only. */
class VerificationDecision extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['driver_license_id', 'user_id', 'event', 'outcome', 'reason', 'triggers', 'checks', 'scores', 'settings', 'actor_id'];

    protected $casts = ['triggers' => 'array', 'checks' => 'array', 'scores' => 'array', 'settings' => 'array'];

    public function license(): BelongsTo { return $this->belongsTo(DriverLicense::class, 'driver_license_id'); }
    public function actor(): BelongsTo { return $this->belongsTo(User::class, 'actor_id'); }
}
