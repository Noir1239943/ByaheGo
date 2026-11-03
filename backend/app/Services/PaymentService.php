<?php

namespace App\Services;

use App\Mail\BookingConfirmedMail;
use App\Mail\InvoiceMail;
use App\Models\Booking;
use App\Models\BookingExtension;
use App\Models\Payment;
use App\Models\User;
use App\Support\Money;
use App\Support\Notifier;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

/**
 * Everything that moves money: starting a hosted checkout, confirming it once Xendit says it is paid (from the
 * webhook, from the renter coming back, or from the scheduled sweep: all three end in the same idempotent
 * confirm()), and refunds.
 */
class PaymentService
{
    public function __construct(protected PaymentGateway $gateway, protected InvoiceService $invoices) {}

    public static function receiptNo(string $prefix = 'OR'): string
    {
        do {
            $no = $prefix.'-'.now()->format('Y').'-'.random_int(100000, 999999);
        } while (Payment::where('receipt_no', $no)->exists());
        return $no;
    }

    // ---------------------------------------------------------------- checkout

    /** A pending payment plus a Xendit session for it. The renter is sent to $payment->checkout_url. */
    public function startCheckout(Booking $booking, string $method, string $type = 'charge', ?BookingExtension $extension = null): Payment
    {
        $until = $extension?->requested_return_at->timezone('Asia/Manila')->format('M j, g:i A');
        [$amount, $description, $items] = match ($type) {
            'extension' => [(int) $extension->amount, "Extra time for {$booking->reference}: return moved to {$until}", [['label' => "Extra rental time ({$extension->hours} h) until {$until}", 'amount' => (int) $extension->amount]]],
            'balance' => [(int) $booking->balance_due, "Remaining balance for {$booking->reference}", [['label' => "Remaining balance (late fee and approved charges) for {$booking->reference}", 'amount' => (int) $booking->balance_due]]],
            default => [(int) ($booking->total + $booking->security_deposit), "Trip {$booking->reference} – {$booking->vehicle->name} (includes ".Money::peso($booking->security_deposit).' refundable deposit)', InvoiceService::tripItems($booking)],
        };
        $payment = $booking->payments()->create([
            'user_id' => $booking->renter_id, 'type' => $type, 'method' => $method, 'provider' => 'xendit', 'amount' => $amount, 'status' => 'pending',
            'receipt_no' => self::receiptNo(), 'description' => $description, 'items' => $items,
        ]);

        // The return page opens on the extension tab for an extension payment.
        $front = rtrim((string) config('app.frontend_url'), '/')."/checkout/return/{$booking->reference}".($type === 'extension' ? '?extension=1' : '');
        try {
            $session = $this->gateway->createSession($payment->receipt_no, $amount, "ByaheGo trip {$booking->reference} – {$booking->vehicle->name}", $method, $front, $front.($type === 'extension' ? '&' : '?').'cancelled=1');
        } catch (PaymentGatewayException $e) {
            Log::warning("Could not start payment for {$booking->reference}: ".$e->getMessage().' '.$e->errorCode);
            $payment->update(['status' => 'failed', 'failure_reason' => mb_substr($e->getMessage(), 0, 250)]);
            throw $e;
        }
        $payment->update(['provider_session_id' => $session['id'], 'checkout_url' => $session['url']]);
        $booking->log('payment', 'Checkout opened for '.Money::peso($amount).' with '.PaymentGateway::label($method).'. Waiting for payment.', $booking->renter_id);
        return $payment;
    }

    /** The payment page to send a renter to. A finished or expired session is replaced by a fresh one. */
    public function resume(Booking $booking, ?string $method = null): Payment
    {
        $current = $booking->payments()->where('type', 'charge')->where('status', 'pending')->latest('id')->first();
        if ($current) {
            $state = $this->verify($current);
            if ($state->status === 'pending' && $state->checkout_url) return $state;
            if ($state->status === 'succeeded') return $state;
        }
        $booking->refresh();
        if ($booking->status !== 'pending') {
            throw ValidationException::withMessages(['booking' => 'This booking is not waiting for payment.']);
        }
        return $this->startCheckout($booking, $method ?: ($current?->method ?? $booking->payment_method));
    }

    // ---------------------------------------------------------------- confirming

    /** Ask Xendit how the session is doing and apply it. Safe to call as often as you like. */
    public function verify(Payment $payment): Payment
    {
        if ($payment->status !== 'pending' || ! $payment->provider_session_id) return $payment->fresh();
        try {
            $s = $this->gateway->retrieveSession($payment->provider_session_id);
        } catch (PaymentGatewayException $e) {
            Log::warning("Could not check payment {$payment->receipt_no}: ".$e->getMessage());
            return $payment->fresh();
        }
        return match ($s['status']) {
            'paid' => $this->confirm($payment, (string) $s['payment_id']),
            'expired', 'canceled' => $this->closeUnpaid($payment, $s['status']),
            default => $payment->fresh(),
        };
    }

    public function confirm(Payment $payment, string $providerPaymentId): Payment
    {
        $confirmed = false;
        $refundAll = false;
        DB::transaction(function () use ($payment, $providerPaymentId, &$confirmed, &$refundAll) {
            $p = Payment::whereKey($payment->id)->lockForUpdate()->firstOrFail();
            if ($p->status === 'succeeded') return; // webhook and return page can both arrive: the second one changes nothing
            $b = Booking::whereKey($p->booking_id)->lockForUpdate()->firstOrFail();

            $p->update(['status' => 'succeeded', 'provider_payment_id' => $providerPaymentId, 'paid_at' => now(), 'account_hint' => PaymentGateway::label($p->method), 'failure_reason' => null]);
            $confirmed = true;

            if ($p->type === 'balance') {
                $b->update(['balance_due' => 0, 'payment_status' => 'paid']);
                $b->log('payment', 'Remaining balance of '.Money::peso($p->amount).' paid with '.PaymentGateway::label($p->method).'.', $b->renter_id);
                return;
            }

            if ($p->type === 'extension') {
                // The return time moves only now that the money is in, and only if the extension is still open and the car still free.
                $ext = BookingExtension::where('payment_id', $p->id)->lockForUpdate()->first();
                $open = $ext && $ext->status === 'awaiting_payment' && now()->lessThanOrEqualTo($ext->previous_return_at) && $b->status === 'active'
                    && ! $b->checkout_submitted_at && $b->return_at->equalTo($ext->previous_return_at) && $b->vehicle->isFreeBetween($ext->previous_return_at, $ext->requested_return_at);
                if ($open) {
                    $ext->update(['status' => 'approved']);
                    $b->update(['return_at' => $ext->requested_return_at, 'return_reminder_sent_at' => null]);
                    $b->log('extension', 'Extension paid ('.Money::peso($p->amount).'). New return time: '.$ext->requested_return_at->timezone('Asia/Manila')->format('M j, g:i A').'.', $b->renter_id);
                    Notifier::send($b->renter_id, 'Extension confirmed', "New return time for {$b->reference}: {$ext->requested_return_at->timezone('Asia/Manila')->format('M j, g:i A')}. No late fee until then.", "/account/trips/{$b->reference}", 'success');
                    Notifier::send($b->host_id, 'Extension paid', "{$b->renter->name} paid ".Money::peso($p->amount)." for more time. New return time: {$ext->requested_return_at->timezone('Asia/Manila')->format('M j, g:i A')}.", "/host/bookings/{$b->reference}", 'success');
                } else {
                    // Paid too late (the original return time passed, so normal late fees apply), or the car is no longer free: money back.
                    $ext?->update(['status' => 'lapsed']);
                    $refundAll = true;
                    $b->log('extension', 'Extension payment arrived too late or the car is no longer free, so it is being refunded.');
                    Notifier::send($b->renter_id, 'Extension payment refunded', 'Your extension payment arrived after the original return time (or the car was no longer free), so it is being refunded. Normal late fees apply.', "/account/trips/{$b->reference}", 'warning');
                }
                return;
            }

            if (in_array($b->status, ['confirmed', 'active', 'completed'], true)) return; // already confirmed by another payment: nothing more to do

            // Paid after the hold ran out: keep the booking only if nobody took the dates in the meantime.
            if ($b->status === 'cancelled') {
                $stillFree = $b->vehicle->isFreeBetween($b->pickup_at, $b->return_at) && $b->vehicle->status === 'live';
                if (! $stillFree) {
                    $refundAll = true;
                    $b->log('payment', 'Payment arrived after the booking expired and the dates were taken, so it is being refunded.');
                    return;
                }
                $b->log('payment', 'Payment arrived after the hold ran out; the dates were still free so the booking is back on.');
            }

            $b->update([
                'status' => 'confirmed', 'payment_status' => 'paid', 'deposit_status' => 'held', 'amount_paid' => $p->amount, 'payment_method' => $p->method,
                'expires_at' => null, 'cancelled_at' => null, 'cancelled_by' => null, 'cancel_reason' => null,
            ]);
            $b->log('payment', 'Payment of '.Money::peso($p->amount).' received via '.PaymentGateway::label($p->method).'.', $b->renter_id);
            $b->log('deposit', 'Security deposit of '.Money::peso($b->security_deposit).' placed on hold.');
            Notifier::send($b->renter_id, 'Your trip is booked!', "{$b->vehicle->name} · pick-up {$b->pickup_at->format('M j, g:i A')}. Reference {$b->reference}.", "/account/trips/{$b->reference}", 'success');
            Notifier::send($b->host_id, 'New booking', "{$b->renter->name} booked your {$b->vehicle->name} for {$b->days} day(s).", "/host/bookings/{$b->reference}", 'success');
        });

        $payment = $payment->fresh(['booking']);
        if ($confirmed) {
            $invoice = $this->tryInvoice($payment);
            if ($refundAll) {
                $this->refund($payment->booking, (int) $payment->amount, $payment->type === 'extension' ? 'Automatic refund: the extension could not be applied' : 'Automatic refund: the booking had already expired', null, 'OTHERS', null, $payment->type === 'extension' ? $payment : null);
            } elseif ($payment->type === 'charge') {
                $this->sendConfirmationEmails($payment->booking->fresh(), $invoice);
            } elseif ($invoice) {
                $this->mailInvoice($invoice, $payment->booking->renter);
            }
        }
        return $payment->fresh();
    }

    /** A problem while printing an invoice must never undo or hide a payment that really went through; syncPending() retries it. */
    protected function tryInvoice(Payment $payment)
    {
        try {
            return $this->invoices->issueFor($payment);
        } catch (\Throwable $e) {
            Log::error("Could not issue the invoice for payment {$payment->receipt_no}: ".$e->getMessage());
            return null;
        }
    }

    /** The session ended without a payment (expired, cancelled by the renter). The booking stops holding its dates. */
    protected function closeUnpaid(Payment $payment, string $why): Payment
    {
        $payment->update(['status' => $why === 'expired' ? 'expired' : 'failed', 'failure_reason' => $why === 'expired' ? 'The payment page expired.' : 'The payment was cancelled.']);
        $b = $payment->booking;
        if ($payment->type === 'charge' && $b->status === 'pending') {
            // Another session may still be open (the renter retried), so only let go of the dates when none is.
            if (! $b->payments()->where('type', 'charge')->where('status', 'pending')->exists()) {
                $b->update(['expires_at' => now()]);
                app(BookingService::class)->expirePending();
            }
        }
        return $payment->fresh();
    }

    public function verifyBooking(Booking $booking): Booking
    {
        foreach ($booking->payments()->whereIn('type', Payment::MONEY_IN)->where('status', 'pending')->get() as $p) $this->verify($p);
        return $booking->fresh();
    }

    /** The scheduled safety net for when webhooks can't reach us (local development, or a missed delivery). */
    public function syncPending(): int
    {
        $n = 0;
        Payment::whereIn('type', Payment::MONEY_IN)->where('status', 'pending')->whereNotNull('provider_session_id')->where('created_at', '>=', now()->subHours(3))
            ->each(function (Payment $p) use (&$n) { $this->verify($p); $n++; });
        Payment::where('type', 'refund')->where('status', 'pending')->whereNotNull('provider_refund_id')
            ->each(function (Payment $p) use (&$n) { $this->syncRefund($p); $n++; });
        // Paid online but no invoice yet (printing it failed the first time): try again.
        Payment::where('status', 'succeeded')->whereIn('type', [...Payment::MONEY_IN, 'refund'])->whereNotNull('provider')->doesntHave('invoice')->limit(50)
            ->each(function (Payment $p) use (&$n) { if ($this->tryInvoice($p)) $n++; });
        return $n;
    }

    protected function sendConfirmationEmails(Booking $booking, $invoice): void
    {
        $booking->loadMissing(['renter', 'host', 'vehicle', 'agreement']);
        foreach ([[$booking->renter, false], [$booking->host, true]] as [$to, $forHost]) {
            try {
                if ($to?->email) Mail::to($to->email)->send(new BookingConfirmedMail($booking, $to, $forHost, $forHost ? null : $invoice));
            } catch (\Throwable $e) {
                Log::warning("Could not email {$booking->reference} confirmation to user {$to?->id}: ".$e->getMessage());
            }
        }
    }

    protected function mailInvoice($invoice, ?User $to): void
    {
        try {
            if ($to?->email) Mail::to($to->email)->send(new InvoiceMail($invoice, $to));
        } catch (\Throwable $e) {
            Log::warning("Could not email {$invoice->number} to user {$to?->id}: ".$e->getMessage());
        }
    }

    // ---------------------------------------------------------------- refunds

    /** What can still go back to the renter: money in, minus refunds that are done or on the way, minus charges taken. */
    public function refundable(Booking $booking): int
    {
        $in = (int) $booking->payments()->whereIn('type', Payment::MONEY_IN)->where('status', 'succeeded')->sum('amount');
        $out = (int) $booking->payments()->where('type', 'refund')->whereIn('status', ['pending', 'succeeded'])->sum('amount');
        $kept = (int) $booking->payments()->whereIn('type', ['late_fee', 'damage', 'cancellation_fee'])->where('status', 'succeeded')->sum('amount');
        return max(0, $in - $out - $kept);
    }

    /**
     * Pays $amount back to the renter, taking it from the original payment(s). Never throws on a provider error:
     * the refund is saved as failed so an admin can retry it, and the cancellation or settlement it belongs to carries on.
     *
     * @return Payment[] the refund rows created
     */
    public function refund(Booking $booking, int $amount, string $description, ?User $actor = null, string $providerReason = 'OTHERS', ?string $reason = null, ?Payment $from = null): array
    {
        $max = $this->refundable($booking);
        if ($amount <= 0 || $amount > $max) {
            throw ValidationException::withMessages(['amount' => 'Refund must be between ₱1 and '.Money::peso($max).'.']);
        }
        $rows = [];
        $left = $amount;
        $charges = $from ? collect([$from]) : $booking->payments()->whereIn('type', Payment::MONEY_IN)->where('status', 'succeeded')->orderBy('id')->get(); // a refund of one specific payment (an extension) goes back through that payment
        foreach ($charges as $charge) {
            if ($left <= 0) break;
            $already = (int) $booking->payments()->where('type', 'refund')->where('parent_id', $charge->id)->whereIn('status', ['pending', 'succeeded'])->sum('amount');
            $take = min($left, (int) $charge->amount - $already);
            if ($take <= 0) continue;
            $row = $booking->payments()->create([
                'parent_id' => $charge->id, 'user_id' => $booking->renter_id, 'type' => 'refund', 'method' => $charge->method, 'provider' => $charge->provider,
                'amount' => $take, 'status' => 'pending', 'receipt_no' => self::receiptNo('RF'), 'account_hint' => $charge->account_hint,
                'description' => $description, 'reason' => $reason ?? $description, 'requested_by' => $actor?->id,
            ]);
            $this->dispatchRefund($row, $providerReason, $actor);
            $rows[] = $row->fresh();
            $left -= $take;
        }
        if ($left > 0) {
            // Money that came in without a recorded online payment (older test data): keep the books right and refund by hand.
            $row = $booking->payments()->create([
                'user_id' => $booking->renter_id, 'type' => 'refund', 'method' => $booking->payment_method, 'amount' => $left, 'status' => 'pending',
                'receipt_no' => self::receiptNo('RF'), 'description' => $description, 'reason' => $reason ?? $description, 'requested_by' => $actor?->id,
            ]);
            $this->dispatchRefund($row, $providerReason, $actor);
            $rows[] = $row->fresh();
        }

        $booking->log('refund', 'Refund of '.Money::peso($amount).' started to '.PaymentGateway::label($booking->payment_method).'.', $actor?->id);
        Notifier::send($booking->renter_id, 'Refund started', Money::peso($amount)." is being refunded for {$booking->reference}. It may take 3–5 banking days to appear.", '/account/billing', 'success');
        return $rows;
    }

    /** Sends one refund row to Xendit. Records the result, and a failure, without throwing. */
    public function dispatchRefund(Payment $refund, string $providerReason = 'OTHERS', ?User $actor = null): Payment
    {
        $parent = $refund->parent;
        if (! $parent?->provider_payment_id) {
            // Nothing was paid online (older test data), so there is nothing to send: mark it paid out by hand.
            $refund->update(['status' => 'succeeded', 'gateway_ref' => 'MANUAL', 'paid_at' => now(), 'processed_by' => $actor?->id]);
            $this->tryInvoice($refund->fresh());
            return $refund->fresh();
        }
        $refund->increment('attempts');
        // Card refunds only accept FRAUDULENT, DUPLICATE or REQUESTED_BY_CUSTOMER (Xendit rejects the others for cards).
        if ($parent->method === 'card') $providerReason = 'REQUESTED_BY_CUSTOMER';
        try {
            $r = $this->gateway->refund($parent->provider_payment_id, (int) $refund->amount, $refund->receipt_no.'-'.$refund->attempts, $providerReason);
            $refund->update(['provider_refund_id' => $r['id'], 'status' => $r['status'], 'failure_reason' => $r['status'] === 'failed' ? ($r['failure'] ?: 'The provider could not refund this payment.') : null, 'processed_by' => $actor?->id]);
        } catch (PaymentGatewayException $e) {
            Log::warning("Refund {$refund->receipt_no} failed: ".$e->getMessage().' '.$e->errorCode);
            $refund->update(['status' => 'failed', 'failure_reason' => mb_substr($e->getMessage(), 0, 250), 'processed_by' => $actor?->id]);
        }
        return $this->afterRefundState($refund->fresh());
    }

    public function syncRefund(Payment $refund): Payment
    {
        if ($refund->type !== 'refund' || $refund->status !== 'pending' || ! $refund->provider_refund_id) return $refund;
        try {
            $r = $this->gateway->retrieveRefund($refund->provider_refund_id);
        } catch (PaymentGatewayException $e) {
            Log::warning("Could not check refund {$refund->receipt_no}: ".$e->getMessage());
            return $refund;
        }
        if ($r['status'] === 'pending') return $refund;
        $refund->update(['status' => $r['status'], 'failure_reason' => $r['status'] === 'failed' ? ($r['failure'] ?: 'The provider could not refund this payment.') : null]);
        return $this->afterRefundState($refund->fresh());
    }

    protected function afterRefundState(Payment $refund): Payment
    {
        if ($refund->status === 'succeeded') {
            $refund->update(['paid_at' => $refund->paid_at ?? now()]);
            $invoice = $this->tryInvoice($refund->fresh());
            if ($invoice) $this->mailInvoice($invoice, $refund->booking->renter);
        } elseif ($refund->status === 'failed') {
            Notifier::admins('Refund failed', "Refund {$refund->receipt_no} of ".Money::peso($refund->amount)." for {$refund->booking->reference} didn't go through. Retry it or refund by hand.", '/admin/payments?type=refund&status=failed', 'warning');
        }
        return $refund;
    }

    public function retryRefund(Payment $refund, User $admin): Payment
    {
        if ($refund->type !== 'refund' || $refund->status !== 'failed') {
            throw ValidationException::withMessages(['refund' => 'Only a failed refund can be retried.']);
        }
        $refund->update(['status' => 'pending', 'failure_reason' => null]);
        return $this->dispatchRefund($refund->fresh(), 'REQUESTED_BY_CUSTOMER', $admin);
    }

    /** Admin handled a failed refund outside the system (bank transfer, wallet): record it as done. */
    public function markRefundHandled(Payment $refund, User $admin, string $note): Payment
    {
        if ($refund->type !== 'refund' || $refund->status !== 'failed') {
            throw ValidationException::withMessages(['refund' => 'Only a failed refund can be marked as handled by hand.']);
        }
        $refund->update(['status' => 'succeeded', 'gateway_ref' => 'MANUAL', 'paid_at' => now(), 'processed_by' => $admin->id, 'failure_reason' => null, 'reason' => trim(($refund->reason ?? '').' · Paid by hand: '.$note)]);
        $refund->booking->log('refund', "Refund {$refund->receipt_no} was paid out by hand: {$note}", $admin->id);
        return $this->afterRefundState($refund->fresh());
    }
}
