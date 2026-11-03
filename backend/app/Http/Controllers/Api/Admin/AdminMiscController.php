<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminAuditLog;
use App\Support\Present;
use App\Models\SupportTicket;
use App\Support\Notifier;
use App\Support\Settings;
use Illuminate\Http\Request;

class AdminMiscController extends Controller
{
    public function support(Request $request)
    {
        $status = $request->input('status', 'open');
        $q = SupportTicket::when($status !== 'all', fn ($w) => $w->where('status', $status))->latest();
        $page = $q->paginate(12);
        return response()->json([
            'data' => collect($page->items())->map(fn ($t) => $t->only(['id', 'name', 'email', 'topic', 'booking_reference', 'message', 'status', 'reply']) + [
                'created_at' => $t->created_at?->toIso8601String(),
            ]),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total(), 'per_page' => $page->perPage()],
        ]);
    }

    public function replySupport(Request $request, int $id)
    {
        $data = $request->validate(['reply' => ['required', 'string', 'max:2000']]);
        $ticket = SupportTicket::findOrFail($id);
        $ticket->update(['reply' => $data['reply'], 'status' => 'closed']);
        if ($ticket->user_id) {
            Notifier::send($ticket->user_id, 'Support replied to your message', mb_strimwidth($data['reply'], 0, 180, '…'), '/help', 'info');
        }
        return response()->json(['ok' => true]);
    }

    public function auditLog(Request $request)
    {
        $q = AdminAuditLog::with('actor')->latest('id');
        if ($action = $request->input('action')) $q->where('action', 'like', $action.'%');
        if ($term = trim((string) $request->input('q'))) {
            $like = '%'.mb_strtolower($term).'%';
            $q->where(fn ($w) => $w->whereRaw('LOWER(target_label) LIKE ?', [$like])->orWhereRaw('LOWER(reason) LIKE ?', [$like])
                ->orWhereHas('actor', fn ($a) => $a->whereRaw('LOWER(name) LIKE ?', [$like])));
        }
        return response()->json(Present::paginated($q->paginate(20), fn ($l) => [
            'id' => $l->id, 'action' => $l->action, 'actor' => $l->actor?->name, 'target_type' => $l->target_type, 'target_id' => $l->target_id,
            'target_label' => $l->target_label, 'reason' => $l->reason, 'meta' => $l->meta, 'ip' => $l->ip, 'created_at' => $l->created_at?->toIso8601String(),
        ]));
    }

    public function settings()
    {
        return response()->json(['values' => Settings::all(), 'labels' => Settings::LABELS]);
    }

    public function updateSettings(Request $request)
    {
        $data = $request->validate([
            'service_fee_rate' => ['required', 'numeric', 'between:0,30'],
            'commission_rate' => ['required', 'numeric', 'between:0,50'],
            'late_grace_minutes' => ['required', 'integer', 'between:0,240'],
            'cancellation_cutoff_hours' => ['required', 'integer', 'between:0,168'],
            'late_fee_daily_cap' => ['required', 'numeric', 'between:1,5'],
            'deposit_release_days' => ['required', 'integer', 'between:1,14'],
            'default_security_deposit' => ['required', 'integer', 'between:0,100000'],
            'cancellation_fee' => ['required', 'integer', 'between:0,10000'],
            'pending_booking_minutes' => ['required', 'integer', 'between:5,240'],
        ]);
        Settings::set($data);
        AdminAuditLog::record($request->user(), 'settings.update', null, null, $data);
        return response()->json(['values' => Settings::all(), 'labels' => Settings::LABELS]);
    }
}
