<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DriverLicense;
use App\Models\Media;
use App\Services\VerificationChecker;
use App\Services\VerificationDecider;
use App\Support\Notifier;
use App\Support\Present;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class VerificationController extends Controller
{
    public function show(Request $request)
    {
        $user = $request->user();
        return response()->json([
            'status' => $user->verification_status,
            'license' => Present::license($user->latestLicense),
        ]);
    }

    public function store(Request $request, VerificationChecker $checker, VerificationDecider $decider)
    {
        $user = $request->user();
        if ($user->verification_status === 'pending') {
            return response()->json(['message' => 'We\'re already reviewing your documents. This usually takes less than 24 hours.'], 422);
        }
        if ($user->verification_status === 'verified') {
            return response()->json(['message' => 'Your license is already verified.'], 422);
        }
        $ownMedia = fn (string $purpose) => ['required', 'integer', Rule::exists('media', 'id')->where('user_id', $user->id)->where('purpose', $purpose)];
        $data = $request->validate([
            'license_type' => ['required', Rule::in(['ph', 'foreign'])],
            'license_number' => ['required', 'string', 'max:40'],
            'full_name' => ['required', 'string', 'max:100'],
            'birthdate' => ['required', 'date', 'before:today'],
            'expiry_date' => ['required', 'date'],
            'address' => ['nullable', 'string', 'max:200'],
            'client_checks' => ['nullable', 'array'],
            'nationality' => ['nullable', 'string', 'max:60'],
            'restriction_codes' => ['nullable', 'array'],
            'restriction_codes.*' => ['string', 'max:5'],
            'front_media_id' => $ownMedia('license_front'),
            'back_media_id' => $ownMedia('license_back'),
            'selfie_media_id' => $ownMedia('selfie'),
            'confirm_accurate' => ['accepted'],
        ], [
            'front_media_id.required' => 'Please upload a photo of the front of your license.',
            'back_media_id.required' => 'Please upload a photo of the back of your license.',
            'selfie_media_id.required' => 'Please take a live selfie holding your license.',
            'confirm_accurate.accepted' => 'Please confirm your details are accurate.',
            'birthdate.before' => 'Please enter a valid birthdate.',
        ]);
        if (filled($data['address'] ?? null) && ($problem = VerificationChecker::addressProblem($data['address']))) {
            return response()->json(['message' => $problem, 'errors' => ['address' => [$problem]]], 422);
        }
        unset($data['confirm_accurate']);
        // What the browser says about the photos is kept as supporting evidence only; the server runs its own checks below.
        $data['client_checks'] = VerificationChecker::sanitizeClientChecks($data['client_checks'] ?? null);
        $data['license_number'] = strtoupper(trim($data['license_number']));

        $license = DriverLicense::create($data + ['user_id' => $user->id, 'status' => 'pending']);
        $result = $checker->run($license, $user);
        $license->update(['auto_score' => $result['score'], 'auto_label' => $result['label'], 'auto_checks' => $result['checks']]);

        // Reject on critical failures, approve only when everything clearly passes (if enabled), otherwise queue for an admin.
        $decision = $decider->apply($license->fresh(), $user, $result);

        return response()->json([
            'status' => $user->fresh()->verification_status,
            'decision' => $decision['outcome'],
            'message' => $decision['user_message'],
            'license' => Present::license($license->fresh()),
        ], 201);
    }
}
