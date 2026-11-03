<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HostApplication;
use App\Support\Notifier;
use App\Support\Present;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class HostApplicationController extends Controller
{
    public function show(Request $request)
    {
        return response()->json(['application' => Present::hostApplication($request->user()->hostApplication), 'can_apply' => $request->user()->isVerified()]);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        if ($user->isHost() || $user->isAdmin()) {
            return response()->json(['message' => 'You already have hosting access.'], 422);
        }
        if ($user->hostApplication?->status === 'pending') {
            return response()->json(['message' => 'Your application is already being reviewed.'], 422);
        }
        if (! $user->isVerified()) {
            return response()->json(['message' => 'Please verify your driver\'s license before applying to host.', 'code' => 'verification_required'], 422);
        }
        $request->merge([
            'phone' => preg_replace('/[\s-]/', '', (string) $request->input('phone')),
            'payout_account_number' => preg_replace('/[\s-]/', '', (string) $request->input('payout_account_number')),
        ]);
        $data = $request->validate([
            'full_name' => ['required', 'string', 'max:100'],
            'phone' => ['required', 'regex:/^(\+?63|0)9\d{9}$/'],
            'city' => ['required', 'string', 'max:80'],
            'address' => ['required', 'string', 'min:8', 'max:200'],
            'vehicle_count' => ['required', 'integer', 'min:1', 'max:200'],
            'vehicle_types' => ['required', 'array', 'min:1'],
            'vehicle_types.*' => [Rule::in(['sedan', 'hatchback', 'suv', 'mpv', 'van', 'pickup', 'motorcycle'])],
            'business_name' => ['nullable', 'string', 'max:100'],
            'payout_method' => ['required', Rule::in(['gcash', 'bank'])],
            'payout_bank' => ['required_if:payout_method,bank', 'nullable', 'string', 'max:60'],
            'payout_account_name' => ['required', 'string', 'max:80'],
            'payout_account_number' => ['required', 'string', 'min:6', 'max:30'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'agree_terms' => ['accepted'],
        ], ['agree_terms.accepted' => 'Please accept the host terms to continue.', 'phone.regex' => 'Enter a Philippine mobile number, e.g. 0917 123 4567.', 'address.required' => 'Enter your address.', 'payout_bank.required_if' => 'Enter your bank name.', 'vehicle_types.required' => 'Pick at least one vehicle type.']);
        unset($data['agree_terms']);
        $data['phone'] = preg_replace('/[\s-]/', '', $data['phone']);
        $data['payout_account_number'] = preg_replace('/[\s-]/', '', $data['payout_account_number']);
        $app = HostApplication::create($data + ['user_id' => $user->id, 'status' => 'pending', 'terms_accepted_at' => now(), 'terms_version' => '1.0']);
        Notifier::send($user, 'Application received', 'Thanks for applying to host on ByaheGo! We\'ll review it within 1–2 business days.', '/account/host-application', 'info');
        Notifier::admins('New host application', "{$user->name} wants to list {$data['vehicle_count']} vehicle(s).", '/admin/host-applications', 'info');
        return response()->json(['application' => Present::hostApplication($app)], 201);
    }
}
