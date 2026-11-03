<?php

namespace App\Services;

use App\Models\DriverLicense;
use App\Models\User;
use App\Models\VerificationDecision;
use App\Support\Notifier;
use Illuminate\Support\Str;

/**
 * Turns the checker's results into a decision and records it:
 *  - reject  : any critical check failed (always on). The renter is told what to retake and can resubmit.
 *  - approve : only if the switch is on AND every check passed (no warnings) AND the face, liveness and anti-spoof
 *              scores clear their minimums by a safe margin (config/verification.php).
 *  - review  : everything else waits in the admin queue as "Needs review".
 * Every decision is written to verification_decisions so it can be audited.
 */
class VerificationDecider
{
    /** A failure on any of these rejects the submission automatically (key => what the renter should do). */
    public const REJECT_ADVICE = [
        'front_face' => "We couldn't find your photo on the front of the license. Retake the front in good light with the whole card visible.",
        'selfie_face' => "We couldn't see your face in the selfie. Retake your live selfie facing the camera in good light.",
        'selfie_challenge' => "We couldn't confirm a live person. Retake your selfie with your camera and follow the blink and head-turn steps.",
        'selfie_liveness' => "We couldn't confirm a live person. Retake your selfie with your camera and follow the blink and head-turn steps.",
        'selfie_antispoof' => "Your selfie looked like a photo or a screen. Retake it live with your camera, in good light.",
        'face_match' => "Your face didn't match the photo on the license. Retake the front of the license and your live selfie in good light, without glare, hats or sunglasses.",
        'expiry' => 'Your license has expired. Renew it with the LTO, then submit the new one.',
        'duplicate' => 'This license is already linked to another ByaheGo account. Contact support if it is yours.',
        'near_duplicate' => 'Some photos look like the same picture. Take separate new photos of the front, the back and a live selfie.',
        'selfie_duplicate' => 'Some photos look like the same picture. Take separate new photos of the front, the back and a live selfie.',
        'reuse' => 'Some photos match photos already on file. Take new photos of your own license and a live selfie.',
    ];

    /** Checks that may legitimately be "not checked" and still allow auto-approval. */
    protected const OPTIONAL = ['address'];

    /** @return array{outcome:string, reason:string, user_message:?string, triggers:array<int,string>} */
    public function decide(array $result, ?array $clientChecks): array
    {
        $by = collect($result['checks'])->keyBy('key');

        $failed = array_values(array_filter(array_keys(self::REJECT_ADVICE), fn ($k) => ($by[$k]['result'] ?? null) === 'fail'));
        if ($failed) {
            $labels = collect($failed)->map(fn ($k) => $by[$k]['label'].' — '.$by[$k]['detail']);
            return [
                'outcome' => 'reject',
                'reason' => 'Auto-rejected. Critical checks failed: '.$labels->implode('; '),
                'user_message' => "We couldn't verify your license automatically. ".collect($failed)->map(fn ($k) => self::REJECT_ADVICE[$k])->unique()->implode(' '),
                'triggers' => $failed,
            ];
        }

        $blockers = $this->approvalBlockers($result, $by, $clientChecks);
        if (! config('verification.auto_approve')) {
            return ['outcome' => 'review', 'reason' => 'Needs review: automatic approval is switched off.', 'user_message' => null, 'triggers' => $blockers];
        }
        if ($blockers) {
            return ['outcome' => 'review', 'reason' => 'Needs review: '.implode('; ', $blockers), 'user_message' => null, 'triggers' => $blockers];
        }
        return ['outcome' => 'approve', 'reason' => 'Auto-approved. All checks passed and the face match, liveness and anti-spoof scores are above their thresholds by the required margin.', 'user_message' => null, 'triggers' => []];
    }

    /** What stops an automatic approval (empty = nothing does). */
    protected function approvalBlockers(array $result, $by, ?array $clientChecks): array
    {
        $blockers = [];
        foreach ($result['checks'] as $c) {
            if ($c['result'] === 'pass') continue;
            if ($c['result'] === 'not_checked' && in_array($c['key'], self::OPTIONAL, true)) continue;
            $blockers[] = $c['label'].' is '.str_replace('_', ' ', $c['result']);
        }
        $scores = [
            'Face match' => [$clientChecks['face_similarity'] ?? null, 'face_match_min', 'face_match'],
            'Liveness' => [$clientChecks['liveness'] ?? null, 'liveness_min', 'liveness'],
            'Anti-spoof' => [$clientChecks['antispoof'] ?? null, 'antispoof_min', 'antispoof'],
        ];
        foreach ($scores as $label => [$value, $minKey, $marginKey]) {
            $needed = (float) config('verification.'.$minKey) + (float) config('verification.margins.'.$marginKey);
            if ($value === null) $blockers[] = "{$label} score was not reported";
            elseif ($value < $needed) $blockers[] = sprintf('%s %d%% is under the %d%% needed for auto-approval', $label, round($value * 100), round($needed * 100));
        }
        return array_values(array_unique($blockers));
    }

    /** Decide, save the outcome on the license and user, notify, and write the audit record. Returns the decision. */
    public function apply(DriverLicense $license, User $user, array $result): array
    {
        $d = $this->decide($result, $license->client_checks);
        $now = now();
        $base = ['auto_decision' => $d['outcome'], 'auto_decision_reason' => $d['reason'], 'auto_decided_at' => $now];

        if ($d['outcome'] === 'reject') {
            $license->update($base + ['status' => 'rejected', 'decision_source' => 'auto', 'rejection_reason' => Str::limit($d['user_message'], 250), 'reviewed_at' => $now]);
            $user->update(['verification_status' => 'rejected']);
            Notifier::send($user, "We couldn't verify your license", $d['user_message'].' You can resubmit with new photos.', '/verify', 'danger');
        } elseif ($d['outcome'] === 'approve') {
            $license->update($base + ['status' => 'approved', 'decision_source' => 'auto', 'reviewed_at' => $now]);
            $user->update(['verification_status' => 'verified']);
            Notifier::send($user, "You're verified!", "Your driver's license was approved. You can now book self-drive trips.", '/vehicles', 'success');
        } else {
            $license->update($base);
            $user->update(['verification_status' => 'pending']);
            Notifier::send($user, 'Documents received', "Thanks! We're reviewing your driver's license. You'll hear from us within 24 hours.", '/verify', 'info');
            Notifier::admins('New license to verify', "{$user->name} submitted a driver's license (auto-check score {$result['score']}%). Needs review.", '/admin/verifications/'.$license->id, 'info');
        }

        $this->log($license, $user, 'auto_decision', $d['outcome'], $d['reason'], $d['triggers'], $result);
        return $d;
    }

    /** A super admin changes an automatic decision. */
    public function override(DriverLicense $license, User $actor, string $outcome, string $note): void
    {
        $user = $license->user;
        $now = now();
        $reason = "Overridden by {$actor->name}: {$note}";
        $license->update([
            'status' => $outcome === 'approve' ? 'approved' : 'rejected',
            'decision_source' => 'admin',
            'rejection_reason' => $outcome === 'reject' ? Str::limit($note, 250) : null,
            'overridden_by' => $actor->id, 'overridden_at' => $now, 'override_note' => Str::limit($note, 250),
            'reviewed_by' => $actor->id, 'reviewed_at' => $now,
        ]);
        if ($outcome === 'approve') {
            $user->update(['verification_status' => 'verified']);
            Notifier::send($user, "You're verified!", "Your driver's license was approved after a review. You can now book self-drive trips.", '/vehicles', 'success');
        } else {
            $user->update(['verification_status' => 'rejected']);
            Notifier::send($user, "We couldn't verify your license", $note.' Please upload your documents again.', '/verify', 'danger');
        }
        $this->log($license, $user, 'override', $outcome, $reason, [], ['score' => $license->auto_score, 'label' => $license->auto_label, 'checks' => $license->auto_checks ?? []], $actor);
    }

    protected function log(DriverLicense $license, User $user, string $event, string $outcome, string $reason, array $triggers, array $result, ?User $actor = null): void
    {
        $cc = $license->client_checks ?? [];
        VerificationDecision::create([
            'driver_license_id' => $license->id,
            'user_id' => $user->id,
            'event' => $event,
            'outcome' => $outcome,
            'reason' => $reason,
            'triggers' => $triggers,
            'checks' => collect($result['checks'])->map(fn ($c) => ['key' => $c['key'], 'result' => $c['result'], 'source' => $c['source'] ?? 'server', 'value' => $c['value'] ?? null])->all(),
            'scores' => [
                'score' => $result['score'] ?? null, 'label' => $result['label'] ?? null,
                'face_similarity' => $cc['face_similarity'] ?? null, 'liveness' => $cc['liveness'] ?? null, 'antispoof' => $cc['antispoof'] ?? null,
            ],
            'settings' => [
                'auto_approve' => (bool) config('verification.auto_approve'),
                'face_match_min' => config('verification.face_match_min'), 'liveness_min' => config('verification.liveness_min'), 'antispoof_min' => config('verification.antispoof_min'),
                'margins' => config('verification.margins'),
            ],
            'actor_id' => $actor?->id,
        ]);
    }
}
