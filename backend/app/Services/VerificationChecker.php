<?php

namespace App\Services;

use App\Http\Controllers\Api\MediaController;
use App\Models\DriverLicense;
use App\Models\Media;
use App\Models\User;
use App\Support\ImageHash;

/**
 * Automated document checker. It combines checks the server can do itself (format, expiry, age, name match, image
 * quality, near-duplicate photos, address sanity, reuse across accounts) with results reported by the renter's
 * browser (face on the license, liveness, face match, OCR). Browser results can be forged, so they are labelled
 * "device" and only support the admin's decision, which is always final.
 *
 * Every check ends in one of four states: pass | warn | fail | not_checked. Something that wasn't checked is never green.
 */
class VerificationChecker
{
    public const PH_LICENSE_PATTERN = '/^[A-Z]\d{2}-\d{2}-\d{6}$/';

    /** A failure here means the submission is very likely fake: score is capped and the label becomes "reject". */
    public const CRITICAL = [
        'front_face', 'front_keywords', 'selfie_face', 'selfie_challenge', 'selfie_liveness', 'selfie_antispoof', 'face_match',
        'selfie_duplicate', 'near_duplicate', 'reuse', 'expiry', 'duplicate',
    ];
    /** The image checks that must really have run for a high score. */
    public const IMAGE_REQUIRED = ['front_face', 'selfie_face', 'selfie_liveness', 'selfie_antispoof', 'face_match'];

    public const CRITICAL_CAP = 30;
    public const INCOMPLETE_CAP = 60;
    public const FAIL_CAP = 69;
    public const GOOD_MIN = 90;

    /** Checks the browser reports (key => label). Anything else in the payload is dropped. */
    public const DEVICE_CHECKS = [
        'front_face' => 'Face found on the license photo',
        'front_keywords' => 'License wording found (OCR)',
        'front_number' => 'License number found on the card (OCR)',
        'front_name' => 'Name found on the card (OCR)',
        'back_text' => 'Readable text on the back (OCR)',
        'back_no_face' => 'No face on the back',
        'back_keywords' => 'Back-of-license wording (OCR)',
        'back_duplicate' => 'Back differs from the front',
        'selfie_face' => 'Face in the live selfie',
        'selfie_challenge' => 'Blink and head-turn challenge',
        'selfie_liveness' => 'Liveness score',
        'selfie_antispoof' => 'Anti-spoof score (not a screen or print)',
        'face_match' => 'Selfie face matches the license photo',
        'selfie_license_face' => 'License held next to the face',
        'selfie_duplicate' => 'Selfie differs from the license photos',
    ];
    /** Device checks that must carry a measured value to be believed. */
    protected const NEEDS_VALUE = ['selfie_liveness', 'selfie_antispoof', 'face_match'];
    /** Device checks the server re-judges from the reported number (check key => config key of its minimum). */
    public const SCORED = ['face_match' => 'face_match_min', 'selfie_liveness' => 'liveness_min', 'selfie_antispoof' => 'antispoof_min'];

    public function run(DriverLicense $license, User $user): array
    {
        $checks = [];
        $add = function (string $key, string $label, string $result, string $detail, string $source = 'server', $value = null) use (&$checks) {
            $checks[] = compact('key', 'label', 'result', 'detail', 'source', 'value'); // result: pass | warn | fail | not_checked
        };

        $front = $license->front_media_id ? Media::find($license->front_media_id) : null;
        $back = $license->back_media_id ? Media::find($license->back_media_id) : null;
        $selfie = $license->selfie_media_id ? Media::find($license->selfie_media_id) : null;
        $photos = ['front of license' => $front, 'back of license' => $back, 'selfie' => $selfie];

        // 1. All documents present
        $missing = array_keys(array_filter($photos, fn ($m) => ! $m));
        $add('documents', 'All documents uploaded', $missing ? 'fail' : 'pass', $missing ? 'Missing: '.implode(', ', $missing) : 'Front, back and selfie received.');

        // 2. Image quality (resolution)
        $present = array_filter($photos);
        if (! $present) {
            $add('quality', 'Photos are large enough to read', 'not_checked', 'No photos to check.');
        } else {
            $lowRes = [];
            foreach ($present as $name => $m) {
                if (($m->width ?? 0) * ($m->height ?? 0) < 600 * 380) $lowRes[] = $name;
            }
            $add('quality', 'Photos are large enough to read', $lowRes ? 'warn' : 'pass', $lowRes ? 'Low resolution: '.implode(', ', $lowRes).'. Zoom in to confirm details.' : 'Resolution looks good on all photos.');
        }

        // 3. Near-duplicate photos within this submission (perceptual hash + exact file match)
        [$state, $detail] = $this->duplicatesWithinSubmission($photos);
        $add('near_duplicate', 'Front, back and selfie are different photos', $state, $detail);

        // 4. Same photos used by another account (exact file or look-alike)
        [$state, $detail] = $this->reusedByOthers($present, $user);
        $add('reuse', 'Photos not used by another account', $state, $detail);

        // 5. Results reported by the browser (face, liveness, OCR…)
        foreach ($this->deviceChecks($license) as $c) {
            $add($c['key'], $c['label'], $c['result'], $c['detail'], 'device', $c['value']);
        }

        // 6. License number format
        $number = strtoupper(trim($license->license_number));
        if ($license->license_type === 'ph') {
            $ok = (bool) preg_match(self::PH_LICENSE_PATTERN, $number);
            $add('format', 'License number format (LTO)', $ok ? 'pass' : 'fail', $ok ? "{$number} matches the LTO format." : "{$number} doesn't match the LTO format (e.g. N01-23-456789).");
        } else {
            $ok = (bool) preg_match('/^[A-Z0-9\- ]{5,20}$/', $number);
            $add('format', 'License number format', $ok ? 'pass' : 'warn', $ok ? 'Looks like a valid foreign license number.' : 'Unusual license number format – check the photo.');
        }

        // 7. Duplicate license number
        $dup = DriverLicense::where('license_number', $number)->where('user_id', '!=', $user->id)->whereIn('status', ['approved', 'pending'])->exists();
        $add('duplicate', 'License not linked to another account', $dup ? 'fail' : 'pass', $dup ? 'This license number is already on another account.' : 'License number is unique.');

        // 8. Expiry
        $expiry = $license->expiry_date;
        if ($expiry->isPast()) {
            $add('expiry', 'License is not expired', 'fail', 'Expired on '.$expiry->format('M j, Y').'.');
        } elseif ($expiry->lessThan(now()->addDays(30))) {
            $add('expiry', 'License is not expired', 'warn', 'Expires soon ('.$expiry->format('M j, Y').').');
        } else {
            $add('expiry', 'License is not expired', 'pass', 'Valid until '.$expiry->format('M j, Y').'.');
        }

        // 9. Age 21+
        $age = $license->birthdate->age;
        $add('age', 'Driver is at least 21', $age >= 21 ? 'pass' : 'fail', "Driver is {$age} years old.");

        // 10. Name matches account
        $similarity = $this->nameSimilarity($license->full_name, $user->name);
        $add('name', 'Name matches the account', $similarity >= 80 ? 'pass' : ($similarity >= 55 ? 'warn' : 'fail'),
            "License: \"{$license->full_name}\" · Account: \"{$user->name}\" ({$similarity}% match).");

        // 11. Address looks like an address
        $address = trim((string) $license->address);
        if ($address === '') {
            $add('address', 'Address looks real', 'not_checked', 'No address was entered.');
        } else {
            $problem = self::addressProblem($address);
            $add('address', 'Address looks real', $problem ? 'fail' : 'pass', $problem ?? 'Address has a normal structure.');
        }

        // 12. Restriction codes cover light vehicles
        $codes = array_map('strtoupper', $license->restriction_codes ?? []);
        $light = (bool) array_intersect($codes, ['B', 'B1', 'B2', '1', '2']);
        $add('codes', 'Allowed to drive cars (code B/B1/B2)', $light ? 'pass' : 'warn', $codes ? 'Codes: '.implode(', ', $codes).($light ? '' : ' – car codes not listed, motorcycles only?') : 'No restriction codes provided.');

        [$score, $label] = $this->score($checks);
        return ['score' => $score, 'label' => $label, 'checks' => $checks];
    }

    /**
     * Score 0-100 and a label: reject | incomplete | check | good.
     * Not-checked rows are left out of the average, and a missing image check can never produce a high score.
     */
    public function score(array $checks): array
    {
        $points = ['pass' => 1, 'warn' => 0.5, 'fail' => 0];
        $scored = array_values(array_filter($checks, fn ($c) => $c['result'] !== 'not_checked'));
        $score = $scored ? (int) round(array_sum(array_map(fn ($c) => $points[$c['result']], $scored)) / count($scored) * 100) : 0;
        $by = collect($checks)->pluck('result', 'key');

        if (collect(self::CRITICAL)->contains(fn ($k) => ($by[$k] ?? null) === 'fail')) {
            return [min($score, self::CRITICAL_CAP), 'reject'];
        }
        if (collect(self::IMAGE_REQUIRED)->contains(fn ($k) => ($by[$k] ?? 'not_checked') === 'not_checked')) {
            return [min($score, self::INCOMPLETE_CAP), 'incomplete'];
        }
        if (collect($checks)->contains(fn ($c) => $c['result'] === 'fail')) {
            return [min($score, self::FAIL_CAP), 'check'];
        }
        if (collect(self::IMAGE_REQUIRED)->contains(fn ($k) => ($by[$k] ?? null) !== 'pass')) {
            return [min($score, self::GOOD_MIN - 1), 'check'];
        }
        return [$score, $score >= self::GOOD_MIN ? 'good' : 'check'];
    }

    /** @return array<int, array{key:string,label:string,result:string,detail:string,value:?float}> one row per device check, in a fixed order */
    protected function deviceChecks(DriverLicense $license): array
    {
        $reported = collect($license->client_checks['checks'] ?? [])->keyBy('key');
        $rows = [];
        foreach (self::DEVICE_CHECKS as $key => $label) {
            $c = $reported->get($key);
            $status = $c['status'] ?? 'not_checked';
            $value = isset($c['value']) && is_numeric($c['value']) ? (float) $c['value'] : null;
            if (! in_array($status, ['pass', 'warn', 'fail', 'not_checked'], true)) $status = 'not_checked';
            if ($status === 'pass' && $value === null && in_array($key, self::NEEDS_VALUE, true)) $status = 'not_checked'; // a score check without a score proves nothing
            $detail = $c ? ($c['detail'] ?? '') : '';
            // Scored checks: the server applies its own thresholds to the reported number instead of trusting the device's verdict.
            if (isset(self::SCORED[$key]) && $status !== 'not_checked' && $value !== null) {
                $min = (float) config('verification.'.self::SCORED[$key]);
                $border = $key === 'face_match' ? (float) config('verification.face_match_borderline') : 0.0;
                $status = $value < $min ? 'fail' : ($value < $min + $border ? 'warn' : 'pass');
                $detail = sprintf('Device reported %d%% (minimum %d%%).', round($value * 100), round($min * 100));
            }
            $rows[] = [
                'key' => $key, 'label' => $label, 'result' => $status, 'value' => $value,
                'detail' => $status === 'not_checked' && $detail === '' ? 'The device did not report this check.' : $detail,
            ];
        }
        return $rows;
    }

    /** @return array{0:string,1:string} [state, detail] */
    protected function duplicatesWithinSubmission(array $photos): array
    {
        $names = array_keys($photos);
        $found = [];
        $similar = [];
        $incomparable = [];
        for ($i = 0; $i < 3; $i++) {
            for ($j = $i + 1; $j < 3; $j++) {
                $a = $photos[$names[$i]];
                $b = $photos[$names[$j]];
                if (! $a || ! $b) continue;
                if ($a->sha1 === $b->sha1) { $found[] = "{$names[$i]} and {$names[$j]} are the same file"; continue; }
                $ha = $this->hashOf($a);
                $hb = $this->hashOf($b);
                if (! $ha || ! $hb) { $incomparable[] = "{$names[$i]} / {$names[$j]}"; continue; }
                $d = ImageHash::distance($ha, $hb);
                if ($d <= ImageHash::NEAR_DUPLICATE_DISTANCE) $found[] = "{$names[$i]} and {$names[$j]} look like the same picture (difference {$d}/64)";
                elseif ($d <= ImageHash::SIMILAR_DISTANCE) $similar[] = "{$names[$i]} and {$names[$j]} (difference {$d}/64)";
            }
        }
        if ($found) return ['fail', ucfirst(implode('; ', $found)).'.'];
        if ($similar) return ['warn', 'These photos look very similar: '.implode('; ', $similar).'. Check that they are not shots of the same picture or screen.'];
        if (! ImageHash::available()) return ['not_checked', 'Image comparison is unavailable on the server (PHP GD extension is not enabled).'];
        if (count(array_filter($photos)) < 2) return ['not_checked', 'Not enough photos to compare.'];
        if ($incomparable) return ['warn', 'Some photos have almost no detail (blank or uniform), so they could not be compared: '.implode(', ', $incomparable).'.'];
        return ['pass', 'All photos are clearly different pictures.'];
    }

    /** @return array{0:string,1:string} */
    protected function reusedByOthers(array $present, User $user): array
    {
        if (! $present) return ['not_checked', 'No photos to check.'];
        $exact = false;
        foreach ($present as $m) {
            if (Media::where('sha1', $m->sha1)->where('user_id', '!=', $user->id)->whereIn('purpose', MediaController::ID_PURPOSES)->exists()) $exact = true;
        }
        if ($exact) return ['fail', 'One or more photos were already uploaded by a different account.'];
        if (! ImageHash::available()) return ['warn', 'Only exact file matches were checked (PHP GD extension is not enabled for look-alike detection).'];

        $mine = array_values(array_filter(array_map(fn ($m) => $this->hashOf($m), $present)));
        if ($mine) {
            $others = Media::whereIn('purpose', MediaController::ID_PURPOSES)->where('user_id', '!=', $user->id)->whereNotNull('phash')->select(['id', 'phash'])->limit(50000)->cursor();
            foreach ($others as $o) {
                foreach ($mine as $h) {
                    if (ImageHash::distance($h, $o->phash) <= ImageHash::NEAR_DUPLICATE_DISTANCE) {
                        return ['fail', 'A photo looks almost identical to one uploaded by a different account.'];
                    }
                }
            }
        }
        return ['pass', 'No matching photos on other accounts.'];
    }

    /** Perceptual hash of a stored photo; computed on demand for photos uploaded before hashes were stored. */
    protected function hashOf(Media $m): ?string
    {
        if ($m->phash) return $m->phash;
        $hash = ImageHash::dhash((string) base64_decode((string) $m->data, true));
        if ($hash) $m->forceFill(['phash' => $hash])->saveQuietly();
        return $hash;
    }

    /** Why an address looks like gibberish, or null when it looks like a real one. */
    public static function addressProblem(string $address): ?string
    {
        $msg = "That doesn't look like a real address. Enter the address printed on your license, e.g. Lahug, Cebu City.";
        $a = trim(preg_replace('/\s+/', ' ', $address));
        if (mb_strlen($a) < 8 || ! str_contains($a, ' ')) return $msg;
        $letters = preg_replace('/[^a-z]/i', '', $a);
        if (strlen($letters) < 5) return $msg;
        $ratio = preg_match_all('/[aeiouy]/i', $letters) / strlen($letters);
        if ($ratio < 0.2 || $ratio > 0.7) return $msg;
        if (preg_match('/[bcdfghjklmnpqrstvwxz]{5,}/i', $a) || preg_match('/(.)\1{3,}/i', $a)) return $msg;
        foreach (preg_split('/[\s,.\-\/#]+/', $a) as $word) {
            if (strlen($word) > 18) return $msg;
        }
        $hasShape = preg_match('/\d|,/', $a) || preg_match('/\b(st|street|rd|road|ave|avenue|blvd|brgy|barangay|city|village|subd|subdivision|purok|sitio|lot|blk|block|unit|compound|cebu|manila|davao|mandaue|lapu|talisay|consolacion|cordova)\b/i', $a);
        return $hasShape ? null : $msg;
    }

    /** Keep only the fields we understand from the browser's report, with sane types and sizes. */
    public static function sanitizeClientChecks(?array $raw): ?array
    {
        if (! $raw) return null;
        $num = fn ($v) => is_numeric($v) ? round(max(-1, min(100000, (float) $v)), 4) : null;
        $unit = fn ($v) => is_numeric($v) ? round(max(0, min(1, (float) $v)), 4) : null;
        $checks = [];
        foreach ((array) ($raw['checks'] ?? []) as $c) {
            $key = is_array($c) ? ($c['key'] ?? null) : null;
            if (! is_string($key) || ! isset(self::DEVICE_CHECKS[$key]) || isset($checks[$key])) continue;
            $status = $c['status'] ?? 'not_checked';
            $checks[$key] = [
                'key' => $key,
                'status' => in_array($status, ['pass', 'warn', 'fail', 'not_checked'], true) ? $status : 'not_checked',
                'value' => $num($c['value'] ?? null),
                'detail' => mb_substr(strip_tags((string) ($c['detail'] ?? '')), 0, 240),
            ];
        }
        $box = function ($b) use ($unit) {
            if (! is_array($b)) return null;
            $out = ['x' => $unit($b['x'] ?? null), 'y' => $unit($b['y'] ?? null), 'w' => $unit($b['w'] ?? null), 'h' => $unit($b['h'] ?? null)];
            return in_array(null, $out, true) ? null : $out;
        };
        $ocr = (array) ($raw['ocr_text'] ?? []);
        $thresholds = [];
        foreach (array_slice((array) ($raw['thresholds'] ?? []), 0, 12, true) as $k => $v) {
            if (is_string($k) && is_numeric($v)) $thresholds[mb_substr($k, 0, 40)] = $num($v);
        }
        return [
            'version' => 1,
            'checks' => array_values($checks),
            'face_similarity' => $unit($raw['face_similarity'] ?? null),
            'liveness' => $unit($raw['liveness'] ?? null),
            'antispoof' => $unit($raw['antispoof'] ?? null),
            'ocr_keyword_hits' => array_slice(array_map(fn ($k) => mb_substr(strip_tags((string) $k), 0, 60), array_filter((array) ($raw['ocr_keyword_hits'] ?? []), 'is_string')), 0, 12),
            'ocr_text' => [
                'front' => mb_substr(strip_tags((string) ($ocr['front'] ?? '')), 0, 4000),
                'back' => mb_substr(strip_tags((string) ($ocr['back'] ?? '')), 0, 4000),
            ],
            'faces' => ['license' => $box($raw['faces']['license'] ?? null), 'selfie' => $box($raw['faces']['selfie'] ?? null)],
            'thresholds' => $thresholds,
            'reported_by' => 'device',
        ];
    }

    protected function nameSimilarity(string $a, string $b): int
    {
        $norm = fn ($s) => collect(preg_split('/[\s,.]+/', strtolower(trim($s))))->filter(fn ($t) => strlen($t) > 1)->sort()->values()->all();
        $ta = $norm($a);
        $tb = $norm($b);
        if (! $ta || ! $tb) return 0;
        $common = count(array_intersect($ta, $tb));
        $tokenScore = $common / max(1, min(count($ta), count($tb))) * 100;
        similar_text(implode(' ', $ta), implode(' ', $tb), $pct);
        return (int) round(max($tokenScore, $pct));
    }
}
