<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
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
        ]);
        Settings::set($data);
        return response()->json(['values' => Settings::all(), 'labels' => Settings::LABELS]);
    }
}
