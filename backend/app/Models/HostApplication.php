<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HostApplication extends Model
{
    protected $fillable = [
        'user_id', 'full_name', 'phone', 'city', 'address', 'vehicle_count', 'vehicle_types', 'business_name',
        'payout_method', 'payout_account_name', 'payout_account_number', 'payout_bank', 'terms_accepted_at', 'terms_version', 'notes', 'status', 'admin_notes', 'reviewed_by', 'reviewed_at',
    ];

    // The account number is encrypted at rest (APP_KEY must stay the same, or it can't be read back).
    protected $casts = ['vehicle_types' => 'array', 'reviewed_at' => 'datetime', 'terms_accepted_at' => 'datetime', 'payout_account_number' => 'encrypted'];

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
