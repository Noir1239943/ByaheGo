<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Append-only record of what an admin did, to whom, when and why. */
class AdminAuditLog extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['actor_id', 'action', 'target_type', 'target_id', 'target_label', 'reason', 'meta', 'ip'];

    protected $casts = ['meta' => 'array'];

    public function actor(): BelongsTo { return $this->belongsTo(User::class, 'actor_id'); }

    /**
     * @param string $action  dotted name, e.g. "user.suspend"
     * @param object|null $target  the user / license / booking / listing acted on
     */
    public static function record(?User $actor, string $action, ?object $target = null, ?string $reason = null, array $meta = []): self
    {
        $label = match (true) {
            $target instanceof User => $target->name.' (@'.$target->username.')',
            $target instanceof Booking => $target->reference,
            $target instanceof Vehicle => trim($target->make.' '.$target->model.' '.$target->plate_number),
            $target instanceof DriverLicense => 'License '.$target->license_number,
            $target instanceof HostApplication => 'Host application #'.$target->id,
            $target instanceof Incident => 'Dispute #'.$target->id,
            $target instanceof Payout => 'Payout #'.$target->id,
            default => null,
        };
        return static::create([
            'actor_id' => $actor?->id,
            'action' => $action,
            'target_type' => $target ? strtolower(class_basename($target)) : null,
            'target_id' => $target?->id ?? null,
            'target_label' => $label,
            'reason' => $reason,
            'meta' => $meta ?: null,
            'ip' => request()?->ip(),
        ]);
    }
}
