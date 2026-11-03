<?php

/*
| Automatic ID verification decisions.
|
| - Auto-reject is always on: a critical check failure rejects the submission and tells the renter what to retake.
| - Auto-approve only happens when VERIFICATION_AUTO_APPROVE=true AND every check passes with a safe margin.
| - Everything else waits in the admin "ID verifications" queue as "Needs review".
|
| The *_min values are the pass/fail lines for the scores the renter's device reports. They should match the
| constants in frontend/src/lib/verification/config.ts, which the browser uses to guide the renter.
*/
return [
    'auto_approve' => (bool) env('VERIFICATION_AUTO_APPROVE', false),

    // Below these, the check fails (and the submission is auto-rejected).
    'face_match_min' => (float) env('VERIFICATION_FACE_MATCH_MIN', 0.5),
    'liveness_min' => (float) env('VERIFICATION_LIVENESS_MIN', 0.6),
    'antispoof_min' => (float) env('VERIFICATION_ANTISPOOF_MIN', 0.6),

    // Auto-approve needs each score to clear its minimum by at least this much.
    'margins' => [
        'face_match' => (float) env('VERIFICATION_FACE_MATCH_MARGIN', 0.15),
        'liveness' => (float) env('VERIFICATION_LIVENESS_MARGIN', 0.15),
        'antispoof' => (float) env('VERIFICATION_ANTISPOOF_MARGIN', 0.15),
    ],

    // A face match between the minimum and minimum + this is shown as a warning ("borderline").
    'face_match_borderline' => 0.05,
];
