<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminAuditLog;
use App\Models\Vehicle;
use App\Support\Notifier;
use App\Support\Present;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class AdminListingController extends Controller
{
    public function index(Request $request)
    {
        $status = $request->input('status', 'pending');
        $q = Vehicle::withListStats()->when($status !== 'all', fn ($w) => $w->where('status', $status))->latest('updated_at');
        if ($term = $request->input('q')) {
            $like = '%'.mb_strtolower($term).'%';
            $q->where(fn ($w) => $w->whereRaw('LOWER(make) LIKE ?', [$like])->orWhereRaw('LOWER(model) LIKE ?', [$like])->orWhereRaw('LOWER(plate_number) LIKE ?', [$like]));
        }
        $counts = Vehicle::selectRaw('status, COUNT(*) as total')->groupBy('status')->pluck('total', 'status');
        return response()->json(Present::paginated($q->paginate(12), fn ($v) => Present::hostVehicle($v)) + ['counts' => $counts]);
    }

    public function show(int $id)
    {
        return response()->json(Present::hostVehicle(Vehicle::withListStats()->findOrFail($id)));
    }

    public function approve(Request $request, int $id)
    {
        $v = Vehicle::with(['hub', 'photos', 'host'])->findOrFail($id);
        if ($v->status !== 'pending') throw ValidationException::withMessages(['status' => 'Only listings in review can be approved.']);
        $v->update(['status' => 'live', 'approved_at' => now(), 'rejection_reason' => null]);
        Notifier::send($v->host_id, 'Your listing is live!', "{$v->name} is now visible to renters.", '/host/vehicles', 'success');
        AdminAuditLog::record($request->user(), 'listing.approve', $v);
        return response()->json(Present::hostVehicle($v->fresh(['hub', 'photos', 'host'])));
    }

    public function reject(Request $request, int $id)
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:200']], ['reason.required' => 'Tell the host what to fix.']);
        $v = Vehicle::with(['hub', 'photos', 'host'])->findOrFail($id);
        if ($v->status !== 'pending') throw ValidationException::withMessages(['status' => 'Only listings in review can be rejected.']);
        $v->update(['status' => 'rejected', 'rejection_reason' => $data['reason']]);
        Notifier::send($v->host_id, 'Your listing needs changes', "{$v->name}: {$data['reason']}", "/host/vehicles/{$v->id}/edit", 'warning');
        AdminAuditLog::record($request->user(), 'listing.reject', $v, $data['reason']);
        return response()->json(Present::hostVehicle($v->fresh(['hub', 'photos', 'host'])));
    }

    public function suspend(Request $request, int $id)
    {
        $v = Vehicle::with(['hub', 'photos', 'host'])->findOrFail($id);
        $v->update(['status' => 'paused']);
        AdminAuditLog::record($request->user(), 'listing.pause', $v, $request->input('reason'));
        Notifier::send($v->host_id, 'Listing paused by ByaheGo', "{$v->name} was paused by our team. Contact support for details.", '/host/vehicles', 'warning');
        return response()->json(Present::hostVehicle($v->fresh(['hub', 'photos', 'host'])));
    }
}
