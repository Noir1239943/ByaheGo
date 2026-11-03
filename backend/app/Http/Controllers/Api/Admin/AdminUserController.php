<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\DriverLicense;
use App\Models\HostApplication;
use App\Models\User;
use App\Services\VerificationDecider;
use App\Support\Notifier;
use App\Support\Present;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class AdminUserController extends Controller
{
    public function index(Request $request)
    {
        $q = User::query()->latest();
        if ($term = $request->input('q')) {
            $like = '%'.mb_strtolower($term).'%';
            $q->where(fn ($w) => $w->whereRaw('LOWER(name) LIKE ?', [$like])->orWhereRaw('LOWER(email) LIKE ?', [$like])->orWhereRaw('LOWER(username) LIKE ?', [$like]));
        }
        if ($role = $request->input('role')) $q->where('role', $role);
        if ($status = $request->input('status')) $q->where('status', $status);
        if ($v = $request->input('verification')) $q->where('verification_status', $v);
        $page = $q->paginate(12);
        return response()->json(Present::paginated($page, fn (User $u) => Present::userBrief($u) + [
            'bookings_count' => $u->bookings()->count(),
            'vehicles_count' => $u->vehicles()->count(),
            'last_login_at' => $u->last_login_at?->toIso8601String(),
        ]));
    }

    public function show(int $id)
    {
        $user = User::with('latestLicense')->findOrFail($id);
        return response()->json([
            'user' => Present::user($user),
            'license' => Present::license($user->latestLicense, true),
            'stats' => [
                'trips' => $user->bookings()->where('status', 'completed')->count(),
                'spent' => (int) $user->bookings()->where('status', '!=', 'cancelled')->sum('total'),
                'cancellations' => $user->bookings()->where('status', 'cancelled')->count(),
                'vehicles' => $user->vehicles()->count(),
                'host_earnings' => (int) Booking::where('host_id', $user->id)->where('status', 'completed')->sum('host_earnings'),
            ],
            'bookings' => $user->bookings()->with(['vehicle.hub', 'vehicle.photos', 'host'])->latest()->limit(8)->get()->map(fn ($b) => Present::bookingRow($b)),
        ]);
    }

    public function suspend(Request $request, int $id)
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:200']], ['reason.required' => 'Please give a reason for putting this account on hold.']);
        $user = User::findOrFail($id);
        if ($user->isAdmin()) throw ValidationException::withMessages(['user' => 'Admin accounts can\'t be suspended here.']);
        $user->update(['status' => 'suspended', 'suspended_reason' => $data['reason'], 'suspended_at' => now()]);
        $user->tokens()->delete();
        $user->vehicles()->where('status', 'live')->update(['status' => 'paused']);
        return response()->json(['user' => Present::user($user->fresh())]);
    }

    public function reinstate(int $id)
    {
        $user = User::findOrFail($id);
        $user->update(['status' => 'active', 'suspended_reason' => null, 'suspended_at' => null]);
        Notifier::send($user, 'Your account is active again', 'Welcome back! You can book and host on ByaheGo again.', '/', 'success');
        return response()->json(['user' => Present::user($user->fresh())]);
    }

    public function revokeVerification(Request $request, int $id)
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:200']]);
        $user = User::with('latestLicense')->findOrFail($id);
        $user->latestLicense?->update(['status' => 'revoked', 'rejection_reason' => $data['reason'], 'reviewed_by' => $request->user()->id, 'reviewed_at' => now()]);
        $user->update(['verification_status' => 'unverified']);
        Notifier::send($user, 'Please verify your license again', 'Your license verification was revoked: '.$data['reason'], '/verify', 'warning');
        return response()->json(['user' => Present::user($user->fresh())]);
    }

    // ----- Driver's license verifications -----

    public function verifications(Request $request)
    {
        $status = $request->input('status', 'pending');
        $decision = $request->input('decision'); // auto_approved | auto_rejected: what the rules decided, whoever has the last word
        $q = DriverLicense::with(['user', 'overrider'])
            ->when($decision, fn ($w) => $w->where('auto_decision', $decision === 'auto_approved' ? 'approve' : 'reject'))
            ->when(! $decision && $status !== 'all', fn ($w) => $w->where('status', $status))
            ->latest()->latest('id');
        return response()->json(Present::paginated($q->paginate(12), fn ($l) => Present::license($l, true, false)));
    }

    public function verification(int $id)
    {
        return response()->json(Present::license(DriverLicense::with(['user', 'reviewer', 'overrider', 'decisions.actor'])->findOrFail($id), true));
    }

    public function approveVerification(Request $request, int $id)
    {
        $license = DriverLicense::with('user')->findOrFail($id);
        if ($license->status !== 'pending') throw ValidationException::withMessages(['status' => 'This submission was already reviewed.']);
        $license->update(['status' => 'approved', 'reviewed_by' => $request->user()->id, 'reviewed_at' => now()]);
        $license->user->update(['verification_status' => 'verified']);
        Notifier::send($license->user, 'You\'re verified!', 'Your driver\'s license was approved. You can now book self-drive trips.', '/vehicles', 'success');
        return response()->json(Present::license($license->fresh(['user', 'reviewer']), true));
    }

    /** Super admins can reverse an automatic approval or rejection. The change is written to the audit log. */
    public function overrideVerification(Request $request, VerificationDecider $decider, int $id)
    {
        if (! $request->user()->is_super_admin) {
            return response()->json(['message' => 'Only a super admin can override an automatic decision.'], 403);
        }
        $data = $request->validate([
            'decision' => ['required', 'in:approve,reject'],
            'note' => ['required', 'string', 'min:3', 'max:250'],
        ], ['note.required' => 'Add a note so the change can be audited. For a rejection, tell the renter what to fix.']);
        $license = DriverLicense::with('user')->findOrFail($id);
        if (! in_array($license->auto_decision, ['approve', 'reject'], true)) {
            throw ValidationException::withMessages(['status' => 'Only automatic decisions can be overridden. Use Approve or Reject for submissions that needed review.']);
        }
        if ($license->status === ($data['decision'] === 'approve' ? 'approved' : 'rejected')) {
            throw ValidationException::withMessages(['decision' => 'The submission already has that outcome.']);
        }
        $decider->override($license, $request->user(), $data['decision'], $data['note']);
        return response()->json(Present::license($license->fresh(['user', 'reviewer', 'overrider', 'decisions.actor']), true));
    }

    public function rejectVerification(Request $request, int $id)
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:200']], ['reason.required' => 'Tell the renter what to fix so they can resubmit.']);
        $license = DriverLicense::with('user')->findOrFail($id);
        if ($license->status !== 'pending') throw ValidationException::withMessages(['status' => 'This submission was already reviewed.']);
        $license->update(['status' => 'rejected', 'rejection_reason' => $data['reason'], 'reviewed_by' => $request->user()->id, 'reviewed_at' => now()]);
        $license->user->update(['verification_status' => 'rejected']);
        Notifier::send($license->user, 'We couldn\'t verify your license', $data['reason'].' Please upload your documents again.', '/verify', 'danger');
        return response()->json(Present::license($license->fresh(['user', 'reviewer']), true));
    }

    // ----- Host applications -----

    public function hostApplications(Request $request)
    {
        $status = $request->input('status', 'pending');
        $q = HostApplication::with('user')->when($status !== 'all', fn ($w) => $w->where('status', $status))->latest();
        return response()->json(Present::paginated($q->paginate(12), fn ($a) => Present::hostApplication($a, true)));
    }

    public function approveHost(Request $request, int $id)
    {
        $app = HostApplication::with('user')->findOrFail($id);
        if ($app->status !== 'pending') throw ValidationException::withMessages(['status' => 'This application was already reviewed.']);
        $app->update(['status' => 'approved', 'reviewed_by' => $request->user()->id, 'reviewed_at' => now(), 'admin_notes' => $request->input('notes')]);
        $app->user->update([
            'role' => $app->user->isAdmin() ? 'admin' : 'host',
            'payout_method' => $app->payout_method,
            'payout_account_name' => $app->payout_account_name,
            'payout_account_number' => $app->payout_account_number,
            'phone' => $app->user->phone ?: $app->phone,
            'city' => $app->user->city ?: $app->city,
        ]);
        Notifier::send($app->user, 'Welcome, host!', 'Your host application was approved. List your first vehicle from your host dashboard.', '/host', 'success');
        return response()->json(Present::hostApplication($app->fresh('user'), true));
    }

    public function rejectHost(Request $request, int $id)
    {
        $data = $request->validate(['notes' => ['required', 'string', 'max:200']], ['notes.required' => 'Please tell the applicant why.']);
        $app = HostApplication::with('user')->findOrFail($id);
        if ($app->status !== 'pending') throw ValidationException::withMessages(['status' => 'This application was already reviewed.']);
        $app->update(['status' => 'rejected', 'admin_notes' => $data['notes'], 'reviewed_by' => $request->user()->id, 'reviewed_at' => now()]);
        Notifier::send($app->user, 'Host application update', 'We couldn\'t approve your application: '.$data['notes'], '/account/host-application', 'warning');
        return response()->json(Present::hostApplication($app->fresh('user'), true));
    }
}
