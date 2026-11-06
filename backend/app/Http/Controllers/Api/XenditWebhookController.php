<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Services\PaymentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Xendit calls this when a payment page is paid or expires and when a refund finishes.
 *
 * - It must carry our callback token (`x-callback-token`); anything else is refused.
 * - The body is never trusted for money. It only tells us WHICH session or refund changed; we then ask Xendit's API
 *   for the real state. So a forged or replayed body can't mark anything paid, and a repeat delivery changes nothing.
 * - We answer 200 for events we don't care about so Xendit doesn't keep retrying them.
 */
class XenditWebhookController extends Controller
{
    public function handle(Request $request, PaymentService $payments)
    {
        $token = (string) config('services.xendit.callback_token');
        if ($token === '' || ! hash_equals($token, (string) $request->header('x-callback-token'))) {
            return response()->json(['message' => 'Invalid callback token.'], 401);
        }

        $event = (string) $request->input('event', '');
        $data = (array) $request->input('data', []);
        Log::info('Xendit webhook', ['event' => $event]);

        if (str_starts_with($event, 'payment_session')) {
            $sessionId = $data['payment_session_id'] ?? $data['id'] ?? $request->input('payment_session_id');
            $payment = $sessionId ? Payment::where('provider_session_id', $sessionId)->first() : null;
            if ($payment) $payments->verify($payment);
        } elseif (str_starts_with($event, 'refund')) {
            $refundId = $data['refund_id'] ?? $data['id'] ?? null;
            $refund = $refundId ? Payment::where('provider_refund_id', $refundId)->first() : null;
            if ($refund) $payments->syncRefund($refund);
        }
        return response()->json(['received' => true]);
    }
}
