<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HostApplication extends Model
{
    protected $fillable = [
        'user_id', 'full_name', 'phone', 'city', 'address', 'vehicle_count', 'vehicle_types', 'business_name',
        'payout_method', 'payout_account_name', 'payout_account_number', 'notes', 'status', 'admin_notes', 'reviewed_by', 'reviewed_at',
    ];

    protected $casts = ['vehicle_types' => 'array', 'reviewed_at' => 'datetime'];

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
