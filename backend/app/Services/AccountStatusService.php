<?php

namespace App\Services;

use App\Models\AdminAuditLog;
use App\Models\Booking;
use App\Models\User;
use App\Support\Notifier;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Suspend (temporary, with an end date), revoke (permanent) and reinstate accounts.
 *
 * - The person is signed out everywhere right away (all Sanctum tokens deleted) and sees the reason and how to appeal.
 * - A blocked renter can't book. Their upcoming trips are flagged for an admin to decide.
 * - A blocked host's listings disappear from search (see Vehicle::scopeLive) and their upcoming trips are flagged;
 *   the renters are told, and an admin cancellation gives them a full refund.
 */
class AccountStatusService
{
    public function suspend(User $target, ?User $admin, string $reason, ?Carbon $until, bool $audit = true): User
    {
        return $this->block($target, $admin, 'suspended', $reason, $until, $audit);
    }

    public function revoke(User $target, ?User $admin, string $reason): User
    {
        return $this->block($target, $admin, 'revoked', $reason, null);
    }

    protected function block(User $target, ?User $admin, string $status, string $reason, ?Carbon $until, bool $audit = true): User
    {
        DB::transaction(function () use ($target, $admin, $status, $reason, $until, $audit) {
            $target->update([
                'status' => $status,
                'suspended_reason' => $reason,
                'suspended_at' => now(),
                'suspended_until' => $status === 'suspended' ? $until : null,
                'revoked_at' => $status === 'revoked' ? now() : null,
                'blocked_by' => $admin?->id,
            ]);
            $target->tokens()->delete();
            $this->flagBookings($target, $status, $reason, $until);
            if ($audit) {
                AdminAuditLog::record($admin, $status === 'revoked' ? 'user.revoke' : 'user.suspend', $target, $reason, ['until' => $until?->toIso8601String()]);
            }
        });
        return $target->fresh();
    }

    public function reinstate(User $target, ?User $admin, ?string $note = null, bool $audit = true): User
    {
        DB::transaction(function () use ($target, $admin, $note, $audit) {
            $was = $target->status;
            $target->update(['status' => 'active', 'suspended_reason' => null, 'suspended_at' => null, 'suspended_until' => null, 'revoked_at' => null, 'blocked_by' => null]);
            Booking::whereIn('admin_flag', ['renter_blocked', 'host_blocked'])
                ->where(fn ($q) => $q->where('renter_id', $target->id)->orWhere('host_id', $target->id))
                ->update(['admin_flag' => null, 'admin_flag_note' => null, 'flagged_at' => null]);
            Notifier::send($target, 'Your account is active again', 'Welcome back! You can book and host on ByaheGo again.', '/', 'success');
            if ($audit) AdminAuditLog::record($admin, 'user.reinstate', $target, $note, ['was' => $was]);
        });
        return $target->fresh();
    }

    /** Turn finished suspensions back into active accounts. Runs hourly and whenever a suspended person logs in. */
    public function liftIfExpired(User $user): User
    {
        if ($user->status === 'suspended' && $user->suspended_until && $user->suspended_until->isPast()) {
            return $this->reinstate($user, null, 'Suspension ended automatically.', false);
        }
        return $user;
    }

    public function liftAllExpired(): int
    {
        $n = 0;
        User::where('status', 'suspended')->whereNotNull('suspended_until')->where('suspended_until', '<=', now())->each(function (User $u) use (&$n) {
            $this->liftIfExpired($u);
            $n++;
        });
        return $n;
    }

    protected function flagBookings(User $target, string $status, string $reason, ?Carbon $until): void
    {
        $open = ['confirmed', 'active'];
        $why = ($status === 'revoked' ? 'Account revoked' : 'Account suspended'.($until ? ' until '.$until->timezone('Asia/Manila')->format('M j, Y') : '')).": {$reason}";

        $asRenter = Booking::where('renter_id', $target->id)->whereIn('status', $open)->get();
        foreach ($asRenter as $b) {
            $b->update(['admin_flag' => 'renter_blocked', 'admin_flag_note' => 'Renter: '.$why, 'flagged_at' => now()]);
            $b->log('flag', 'Renter account was blocked. Waiting for an admin to decide what happens to this trip.');
        }
        $asHost = Booking::where('host_id', $target->id)->whereIn('status', $open)->get();
        foreach ($asHost as $b) {
            $b->update(['admin_flag' => 'host_blocked', 'admin_flag_note' => 'Host: '.$why, 'flagged_at' => now()]);
            $b->log('flag', 'Host account was blocked. Waiting for an admin to decide what happens to this trip.');
            Notifier::send($b->renter_id, 'Your host is under review', "Your trip {$b->reference} is on hold while we review the host's account. Our team will contact you, and if the trip is cancelled you get a full refund.", "/account/trips/{$b->reference}", 'warning');
        }
        $count = $asRenter->count() + $asHost->count();
        if ($count > 0) {
            Notifier::admins('Trips need a decision', "{$count} upcoming trip(s) are affected by blocking {$target->name}. Review them and cancel (with refund) or keep them.", '/admin/bookings?flagged=1', 'warning');
        }
    }
}
