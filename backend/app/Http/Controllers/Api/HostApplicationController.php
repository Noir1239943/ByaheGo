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
        return response()->json(['application' => Present::hostApplication($request->user()->hostApplication)]);
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
        $data = $request->validate([
            'full_name' => ['required', 'string', 'max:100'],
            'phone' => ['required', 'string', 'max:20'],
            'city' => ['required', 'string', 'max:80'],
            'address' => ['nullable', 'string', 'max:200'],
            'vehicle_count' => ['required', 'integer', 'min:1', 'max:200'],
            'vehicle_types' => ['required', 'array', 'min:1'],
            'vehicle_types.*' => [Rule::in(['sedan', 'hatchback', 'suv', 'mpv', 'van', 'pickup', 'motorcycle'])],
            'business_name' => ['nullable', 'string', 'max:100'],
            'payout_method' => ['required', Rule::in(['gcash', 'maya', 'bank'])],
            'payout_account_name' => ['required', 'string', 'max:80'],
            'payout_account_number' => ['required', 'string', 'min:6', 'max:30'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'agree_terms' => ['accepted'],
        ], ['agree_terms.accepted' => 'Please accept the host terms to continue.', 'vehicle_types.required' => 'Pick at least one vehicle type.']);
        unset($data['agree_terms']);
        $app = HostApplication::create($data + ['user_id' => $user->id, 'status' => 'pending']);
        Notifier::send($user, 'Application received', 'Thanks for applying to host on ByaheGo! We\'ll review it within 1–2 business days.', '/account/host-application', 'info');
        Notifier::admins('New host application', "{$user->name} wants to list {$data['vehicle_count']} vehicle(s).", '/admin/host-applications', 'info');
        return response()->json(['application' => Present::hostApplication($app)], 201);
    }
}
