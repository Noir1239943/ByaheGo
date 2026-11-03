<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminAuditLog;
use App\Models\Booking;
use App\Models\Incident;
use App\Models\Payment;
use App\Models\Payout;
use App\Services\BookingService;
use App\Services\EvidenceService;
use App\Services\InvoiceService;
use App\Services\PaymentService;
use App\Support\Notifier;
use App\Support\Present;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminBookingController extends Controller
{
    public function __construct(protected BookingService $bookings) {}

    protected function find(string $reference): Booking
    {
        return Booking::where('reference', $reference)->firstOrFail();
    }

    public function index(Request $request)
    {
        $q = Booking::with(['vehicle.hub', 'vehicle.photos', 'renter', 'host', 'incidents'])->latest();
        $status = $request->input('status', 'all');
        match ($status) {
            'upcoming' => $q->where('status', 'confirmed'),
            'active' => $q->where('status', 'active'),
            'completed' => $q->where('status', 'completed'),
            'cancelled' => $q->where('status', 'cancelled'),
            'disputed' => $q->whereHas('incidents', fn ($i) => $i->where('status', 'open')),
            'flagged' => $q->whereNotNull('admin_flag')->whereIn('status', ['confirmed', 'active']),
            default => null,
        };
        if ($term = $request->input('q')) {
            $like = '%'.mb_strtolower($term).'%';
            $q->where(fn ($w) => $w->whereRaw('LOWER(reference) LIKE ?', [$like])
                ->orWhereHas('renter', fn ($r) => $r->whereRaw('LOWER(name) LIKE ?', [$like])->orWhereRaw('LOWER(email) LIKE ?', [$like]))
                ->orWhereHas('vehicle', fn ($v) => $v->whereRaw('LOWER(plate_number) LIKE ?', [$like])->orWhereRaw('LOWER(model) LIKE ?', [$like])));
        }
        $counts = [
            'all' => Booking::count(),
            'upcoming' => Booking::where('status', 'confirmed')->count(),
            'active' => Booking::where('status', 'active')->count(),
            'completed' => Booking::where('status', 'completed')->count(),
            'cancelled' => Booking::where('status', 'cancelled')->count(),
            'disputed' => Booking::whereHas('incidents', fn ($i) => $i->where('status', 'open'))->count(),
            'flagged' => Booking::whereNotNull('admin_flag')->whereIn('status', ['confirmed', 'active'])->count(),
        ];
        $monthStart = now()->startOfMonth();
        return response()->json(Present::paginated($q->paginate(10), fn ($b) => Present::bookingRow($b, true)) + [
            'counts' => $counts,
            'summary' => [
                'this_month' => Booking::where('created_at', '>=', $monthStart)->count(),
                'active_now' => $counts['active'],
                'upcoming_week' => Booking::where('status', 'confirmed')->whereBetween('pickup_at', [now(), now()->addDays(7)])->count(),
                'cancellation_rate' => $counts['all'] ? round($counts['cancelled'] / $counts['all'] * 100, 1) : 0,
            ],
        ]);
    }

    public function agreementPdf(string $reference, \App\Services\AgreementService $agreements)
    {
        return $agreements->download($this->find($reference));
    }

    /** One PDF for the police or an insurer. Every download is logged. */
    public function evidencePdf(Request $request, string $reference, EvidenceService $evidence)
    {
        $booking = $this->find($reference);
        $pdf = $evidence->pdf($booking);
        AdminAuditLog::record($request->user(), 'evidence.download', $booking, null, ['bytes' => strlen($pdf)]);
        $booking->log('evidence', 'Evidence packet downloaded.', $request->user()->id);
        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="ByaheGo-evidence-'.$booking->reference.'.pdf"',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    /** An admin has looked into a "possible theft" flag and is clearing it (the renter's hold is lifted separately on the Users page). */
    public function clearFlag(Request $request, string $reference)
    {
        $data = $request->validate(['note' => ['required', 'string', 'min:5', 'max:300']]);
        $booking = $this->find($reference);
        $booking->update(['admin_flag' => null, 'admin_flag_note' => null, 'flagged_at' => null]);
        $booking->log('flag', 'Admin cleared the flag: '.$data['note'], $request->user()->id);
        AdminAuditLog::record($request->user(), 'booking.clear_flag', $booking, $data['note']);
        return response()->json(Present::booking($booking->fresh(), 'admin'));
    }

    public function show(string $reference)
    {
        return response()->json(Present::booking($this->find($reference), 'admin'));
    }

    public function cancel(Request $request, string $reference)
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:200'], 'refund' => ['boolean']]);
        $booking = $this->bookings->cancel($this->find($reference), 'admin', $data['reason'], $request->user(), $data['refund'] ?? true);
        AdminAuditLog::record($request->user(), 'booking.cancel', $booking, $data['reason'], ['refund' => $data['refund'] ?? true]);
        return response()->json(Present::booking($booking, 'admin'));
    }

    public function refund(Request $request, string $reference)
    {
        $data = $request->validate(['amount' => ['required', 'integer', 'min:1'], 'reason' => ['required', 'string', 'max:200']]);
        $booking = $this->find($reference);
        $refund = $this->bookings->issueRefund($booking, $data['amount'], 'Refund: '.$data['reason'], $request->user(), 'REQUESTED_BY_CUSTOMER');
        AdminAuditLog::record($request->user(), 'booking.refund', $booking, $data['reason'], ['amount' => $data['amount'], 'status' => $refund->status]);
        if ($refund->status === 'failed') {
            // Xendit said no (for example some wallets can't do a partial refund on the day of payment). It stays on the Payments page as a failed refund.
            throw \Illuminate\Validation\ValidationException::withMessages(['amount' => 'Xendit could not refund this: '.($refund->failure_reason ?: 'the provider refused it').' It is saved as a failed refund on the Payments page, where you can retry it later or mark it as paid by hand.']);
        }
        return response()->json(Present::booking($booking->fresh(), 'admin'));
    }

    public function note(Request $request, string $reference)
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:2000']]);
        $booking = $this->find($reference);
        $booking->update(['admin_note' => $data['note']]);
        $booking->log('note', 'Admin note updated.', $request->user()->id);
        return response()->json(Present::booking($booking->fresh(), 'admin'));
    }

    public function message(Request $request, string $reference)
    {
        $data = $request->validate(['to' => ['required', Rule::in(['renter', 'host'])], 'message' => ['required', 'string', 'max:500']]);
        $booking = $this->find($reference);
        $userId = $data['to'] === 'renter' ? $booking->renter_id : $booking->host_id;
        $link = $data['to'] === 'renter' ? "/account/trips/{$booking->reference}" : "/host/bookings/{$booking->reference}";
        Notifier::send($userId, "Message from ByaheGo about {$booking->reference}", $data['message'], $link, 'info');
        $booking->log('message', 'Admin messaged the '.$data['to'].'.', $request->user()->id);
        return response()->json(['ok' => true]);
    }

    public function payments(Request $request)
    {
        $q = Payment::with(['booking.vehicle', 'user', 'invoice', 'requester'])->latest('id');
        if ($type = $request->input('type')) $q->where('type', $type);
        if ($status = $request->input('status')) $q->where('status', $status);
        if ($method = $request->input('method')) $q->where('method', $method);
        if ($from = $request->input('from')) $q->whereDate('created_at', '>=', $from);
        if ($to = $request->input('to')) $q->whereDate('created_at', '<=', $to);
        if ($term = $request->input('q')) {
            $like = '%'.mb_strtolower($term).'%';
            $q->where(fn ($w) => $w->whereRaw('LOWER(receipt_no) LIKE ?', [$like])->orWhereRaw('LOWER(provider_payment_id) LIKE ?', [$like])->orWhereHas('booking', fn ($b) => $b->whereRaw('LOWER(reference) LIKE ?', [$like])));
        }
        return response()->json(Present::paginated($q->paginate(15), fn ($p) => Present::payment($p, true)) + [
            'summary' => [
                'collected' => (int) Payment::whereIn('type', ['charge', 'balance'])->where('status', 'succeeded')->sum('amount'),
                'refunded' => (int) Payment::where('type', 'refund')->where('status', 'succeeded')->sum('amount'),
                'refunds_pending' => (int) Payment::where('type', 'refund')->where('status', 'pending')->sum('amount'),
                'refunds_failed' => Payment::where('type', 'refund')->where('status', 'failed')->count(),
                'fees' => (int) Payment::whereIn('type', ['late_fee', 'damage'])->sum('amount'),
            ],
        ]);
    }

    public function invoicePdf(int $id, InvoiceService $invoices)
    {
        $invoice = $invoices->issueFor(Payment::findOrFail($id));
        abort_if(! $invoice, 404, 'There is no invoice for this payment.');
        return $invoices->download($invoice);
    }

    /** Ask Xendit again about a payment or refund that is still pending. */
    public function syncPayment(int $id, PaymentService $payments)
    {
        $p = Payment::findOrFail($id);
        $p->type === 'refund' ? $payments->syncRefund($p) : $payments->verify($p);
        return response()->json(Present::payment($p->fresh(['invoice', 'requester', 'booking.vehicle', 'user']), true));
    }

    public function retryRefund(Request $request, int $id, PaymentService $payments)
    {
        $p = $payments->retryRefund(Payment::findOrFail($id), $request->user());
        AdminAuditLog::record($request->user(), 'refund.retry', $p, null, ['amount' => $p->amount, 'status' => $p->status]);
        return response()->json(Present::payment($p->fresh(['invoice', 'requester', 'booking.vehicle', 'user']), true));
    }

    public function markRefundHandled(Request $request, int $id, PaymentService $payments)
    {
        $data = $request->validate(['note' => ['required', 'string', 'min:5', 'max:200']]);
        $p = $payments->markRefundHandled(Payment::findOrFail($id), $request->user(), $data['note']);
        AdminAuditLog::record($request->user(), 'refund.manual', $p, $data['note'], ['amount' => $p->amount]);
        return response()->json(Present::payment($p->fresh(['invoice', 'requester', 'booking.vehicle', 'user']), true));
    }

    public function payouts(Request $request)
    {
        $status = $request->input('status', 'scheduled');
        $q = Payout::with(['host', 'booking.vehicle'])->when($status !== 'all', fn ($w) => $w->where('status', $status))->orderBy('scheduled_for');
        return response()->json(Present::paginated($q->paginate(15), fn ($p) => [
            'id' => $p->id, 'amount' => $p->amount, 'status' => $p->status, 'reference' => $p->reference,
            'scheduled_for' => $p->scheduled_for?->toDateString(), 'paid_at' => $p->paid_at?->toIso8601String(),
            'host' => Present::userBrief($p->host), 'payout_method' => $p->host?->payout_method, 'account' => $p->host?->maskedPayoutAccount(),
            'booking_reference' => $p->booking?->reference, 'vehicle_name' => $p->booking?->vehicle?->name,
        ]) + ['summary' => [
            'scheduled' => (int) Payout::where('status', 'scheduled')->sum('amount'),
            'paid' => (int) Payout::where('status', 'paid')->sum('amount'),
            'due_now' => (int) Payout::where('status', 'scheduled')->where('scheduled_for', '<=', today())->sum('amount'),
        ]]);
    }

    public function markPayoutPaid(Request $request, int $id)
    {
        $payout = Payout::with('booking')->findOrFail($id);
        if ($payout->status !== 'paid') {
            $payout->update(['status' => 'paid', 'paid_at' => now(), 'reference' => 'PO-'.now()->format('ymd').'-'.str_pad((string) $payout->id, 4, '0', STR_PAD_LEFT)]);
            $payout->booking?->log('payout', 'Host payout of ₱'.number_format($payout->amount).' sent.');
            AdminAuditLog::record($request->user(), 'payout.mark_paid', $payout, null, ['amount' => $payout->amount]);
            Notifier::send($payout->host_id, 'Payout sent', '₱'.number_format($payout->amount)." for {$payout->booking?->reference} was sent to your payout account.", '/host/earnings', 'success');
        }
        return response()->json(['ok' => true]);
    }

    public function incidents(Request $request)
    {
        $status = $request->input('status', 'open');
        $q = Incident::with(['booking.vehicle', 'booking.renter', 'booking.host', 'reporter'])->when($status !== 'all', fn ($w) => $w->where('status', $status))->latest();
        return response()->json(Present::paginated($q->paginate(12), fn ($i) => Present::incident($i)));
    }

    public function resolveIncident(Request $request, int $id)
    {
        $data = $request->validate([
            'action' => ['required', Rule::in(['charge', 'dismiss'])],
            'amount' => ['required_if:action,charge', 'nullable', 'integer', 'min:0', 'max:5000000'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'suspend_renter' => ['boolean'],
        ]);
        $incident = $this->bookings->resolveIncident(Incident::findOrFail($id), $data['action'], (int) ($data['amount'] ?? 0), $data['notes'] ?? null, (bool) ($data['suspend_renter'] ?? false), $request->user());
        AdminAuditLog::record($request->user(), 'dispute.resolve', $incident, $data['notes'] ?? null, ['action' => $data['action'], 'amount' => (int) ($data['amount'] ?? 0), 'suspend_renter' => (bool) ($data['suspend_renter'] ?? false)]);
        return response()->json(Present::incident($incident->fresh(['booking.vehicle', 'booking.renter', 'booking.host', 'reporter'])));
    }
}
