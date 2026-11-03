<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DriverLicense extends Model
{
    protected $fillable = [
        'user_id', 'license_type', 'license_number', 'full_name', 'birthdate', 'expiry_date', 'address', 'nationality',
        'restriction_codes', 'front_media_id', 'back_media_id', 'selfie_media_id', 'status', 'auto_score', 'auto_checks', 'auto_label', 'client_checks',
        'auto_decision', 'decision_source', 'auto_decision_reason', 'auto_decided_at', 'overridden_by', 'overridden_at', 'override_note',
        'reviewed_by', 'reviewed_at', 'rejection_reason',
    ];

    protected $casts = [
        'birthdate' => 'date',
        'expiry_date' => 'date',
        'restriction_codes' => 'array',
        'auto_checks' => 'array',
        'client_checks' => 'array',
        'reviewed_at' => 'datetime',
        'auto_decided_at' => 'datetime',
        'overridden_at' => 'datetime',
    ];

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function reviewer(): BelongsTo { return $this->belongsTo(User::class, 'reviewed_by'); }
    public function overrider(): BelongsTo { return $this->belongsTo(User::class, 'overridden_by'); }
    public function decisions(): HasMany { return $this->hasMany(VerificationDecision::class)->latest('id'); }
}
