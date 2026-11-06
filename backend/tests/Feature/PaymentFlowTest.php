<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\UserNotification;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** Phase 4: Xendit hosted checkout, verification, refunds and invoices. Xendit itself is faked in TestCase. */
class PaymentFlowTest extends TestCase
{
    /** Starts a booking that has not been paid yet. */
    protected function unpaid(array $over = [], $renter = null, $vehicle = null): array
    {
        $this->xendit['autopay'] = false;
        $this->xendit['session_status'] = 'ACTIVE';
        $renter ??= $this->verifiedRenter();
        $vehicle ??= $this->vehicle();
        $res = $this->book($renter, $vehicle, $over)->assertCreated();
        return [$renter, $vehicle, $res->json('reference'), $res];
    }

    protected function webhook(array $body, string $token = 'cb-token')
    {
        return $this->guest()->postJson('/api/webhooks/xendit', $body, ['x-callback-token' => $token]);
    }

    public function test_booking_is_pending_until_xendit_confirms_and_nothing_is_sent_early(): void
    {
        [$renter, $v, $ref, $res] = $this->unpaid();
        $res->assertJsonPath('status', 'pending')->assertJsonPath('payment_status', 'unpaid')->assertJsonPath('amount_paid', 0);
        $this->assertStringStartsWith('https://pay.test/', $res->json('checkout_url'));
        $this->assertNotNull($res->json('pay_by'));

        // The session asked for exactly one channel, the right amount, and our return pages. No card data is sent.
        $call = $this->xendit['calls'][0];
        $this->assertSame(['GCASH'], $call['allowed_payment_channels']);
        $this->assertSame(11880, $call['amount']);
        $this->assertSame('PHP', $call['currency']);
        $this->assertStringEndsWith("/checkout/return/{$ref}", $call['success_return_url']);
        $this->assertStringEndsWith("/checkout/return/{$ref}?cancelled=1", $call['cancel_return_url']);
        $this->assertArrayNotHasKey('card_number', $call);

        // The host hears nothing and sees nothing; the dates are held for everyone else.
        $this->assertSame(0, UserNotification::where('user_id', $v->host_id)->count());
        $this->as($v->host)->getJson('/api/host/bookings')->assertOk()->assertJsonCount(0, 'data');
        $this->book($this->verifiedRenter(), $v)->assertStatus(422)->assertJsonValidationErrors('pickup_at');
        $this->assertSame(0, Invoice::count());
        $this->assertSame([], app('mailer')->getSymfonyTransport()->messages()->all());
    }

    public function test_return_page_confirms_once_xendit_says_paid_and_is_idempotent(): void
    {
        [$renter, $v, $ref] = $this->unpaid();
        $this->payBooking($renter, $ref)->assertOk()->assertJsonPath('status', 'pending');

        $this->xendit['session_status'] = 'COMPLETED';
        $this->payBooking($renter, $ref)->assertOk()->assertJsonPath('status', 'confirmed')->assertJsonPath('payment_status', 'paid')
            ->assertJsonPath('amount_paid', 11880)->assertJsonPath('deposit_status', 'held')->assertJsonPath('checkout_url', null);
        $this->payBooking($renter, $ref)->assertOk();
        $this->payBooking($renter, $ref)->assertOk();

        $this->assertSame(1, Invoice::where('kind', 'invoice')->count());
        $this->assertSame(1, UserNotification::where('user_id', $v->host_id)->where('title', 'New booking')->count());
        $this->assertSame(2, app('mailer')->getSymfonyTransport()->messages()->count());
        $p = Payment::where('type', 'charge')->first();
        $this->assertSame('py-ps-test-1', $p->provider_payment_id);
        $this->assertNotNull($p->paid_at);
    }

    public function test_every_method_maps_to_its_xendit_channel_and_unsupported_ones_are_refused(): void
    {
        $expected = ['gcash' => 'GCASH', 'maya' => 'PAYMAYA', 'card' => 'CARDS', 'qrph' => 'QRPH', 'grabpay' => 'GRABPAY', 'shopeepay' => 'SHOPEEPAY'];
        $this->xendit['autopay'] = false;
        $this->xendit['session_status'] = 'ACTIVE';
        $renter = $this->verifiedRenter();
        $i = 0;
        foreach ($expected as $method => $channel) {
            $v = $this->vehicle();
            $this->book($renter, $v, ['payment_method' => $method])->assertCreated();
            $this->assertSame([$channel], $this->xendit['calls'][$i++]['allowed_payment_channels'], $method);
        }
        // Google Pay needs enabling on our Xendit account plus a Google merchant ID, and Apple Pay is not offered: neither is a checkout option.
        $this->book($renter, $this->vehicle(), ['payment_method' => 'apple_pay'])->assertStatus(422)->assertJsonValidationErrors('payment_method');
        $this->book($renter, $this->vehicle(), ['payment_method' => 'google_pay'])->assertStatus(422)->assertJsonValidationErrors('payment_method');
    }

    public function test_when_the_payment_page_cannot_open_the_booking_is_dropped(): void
    {
        $this->xendit['fail_sessions'] = true;
        $renter = $this->verifiedRenter();
        $v = $this->vehicle();
        $this->book($renter, $v)->assertStatus(422)->assertJsonValidationErrors('payment');
        $b = Booking::first();
        $this->assertSame('cancelled', $b->status);
        $this->assertSame('failed', Payment::first()->status);

        $this->xendit['fail_sessions'] = false;
        $this->book($renter, $v)->assertCreated()->assertJsonPath('status', 'confirmed'); // dates were released
    }

    public function test_webhook_needs_the_token_and_never_trusts_the_body(): void
    {
        [$renter, $v, $ref] = $this->unpaid();
        $body = ['event' => 'payment_session.completed', 'data' => ['payment_session_id' => 'ps-test-1', 'status' => 'COMPLETED']];

        $this->webhook($body, 'wrong')->assertStatus(401);
        $this->guest()->postJson('/api/webhooks/xendit', $body)->assertStatus(401);
        // The body says paid, but Xendit's API still says the session is open: nothing changes.
        $this->webhook($body)->assertOk();
        $this->assertSame('pending', Booking::where('reference', $ref)->value('status'));

        $this->xendit['session_status'] = 'COMPLETED';
        $this->webhook($body)->assertOk();
        $this->webhook($body)->assertOk(); // Xendit retries: still one booking confirmation, one invoice
        $this->assertSame('confirmed', Booking::where('reference', $ref)->value('status'));
        $this->assertSame(1, Invoice::count());

        // Events about things we don't know are acknowledged and ignored.
        $this->webhook(['event' => 'payment_session.completed', 'data' => ['payment_session_id' => 'ps-unknown']])->assertOk();
        $this->webhook(['event' => 'payment.capture', 'data' => []])->assertOk();
    }

    public function test_webhook_is_refused_when_no_token_is_configured(): void
    {
        config(['services.xendit.callback_token' => '']);
        $this->webhook(['event' => 'x'], '')->assertStatus(401);
    }

    public function test_an_expired_session_frees_the_dates(): void
    {
        [$renter, $v, $ref] = $this->unpaid();
        $this->xendit['session_status'] = 'EXPIRED';
        $this->payBooking($renter, $ref)->assertOk()->assertJsonPath('status', 'cancelled');
        $this->assertSame('expired', Payment::first()->status);
        $this->xendit['autopay'] = true;
        $this->xendit['session_status'] = 'COMPLETED';
        $this->book($this->verifiedRenter(), $v)->assertCreated();
    }

    public function test_the_hold_expires_by_itself_and_late_money_revives_or_is_refunded(): void
    {
        [$renter, $v, $ref] = $this->unpaid();
        Booking::where('reference', $ref)->update(['expires_at' => now()->subMinute()]);
        $this->artisan('bookings:expire-pending')->assertSuccessful();
        $this->assertSame('cancelled', Booking::where('reference', $ref)->value('status'));

        // Paid just after the hold ran out, dates still free: the booking comes back.
        $this->xendit['session_status'] = 'COMPLETED';
        $this->payBooking($renter, $ref)->assertOk()->assertJsonPath('status', 'confirmed');

        // Second case: someone else took the dates, so the late payment is refunded automatically.
        [$r2, $v2, $ref2] = $this->unpaid();
        Booking::where('reference', $ref2)->update(['expires_at' => now()->subMinute()]);
        $this->artisan('bookings:expire-pending')->assertSuccessful();
        $this->xendit['session_status'] = 'COMPLETED';
        $this->xendit['autopay'] = true;
        $this->book($this->verifiedRenter(), $v2)->assertCreated();
        $this->payBooking($r2, $ref2)->assertOk()->assertJsonPath('status', 'cancelled');
        $refund = Payment::where('booking_id', Booking::where('reference', $ref2)->value('id'))->where('type', 'refund')->first();
        $this->assertNotNull($refund);
        $this->assertSame(11880, $refund->amount);
        $this->assertSame('succeeded', $refund->status);
    }

    public function test_cancelling_before_paying_closes_the_page_and_refunds_nothing(): void
    {
        [$renter, $v, $ref] = $this->unpaid();
        $this->as($renter)->postJson("/api/bookings/{$ref}/cancel", [])->assertOk()->assertJsonPath('status', 'cancelled');
        $this->assertSame(0, Payment::where('type', 'refund')->count());
        $this->assertSame('failed', Payment::first()->status);
    }

    public function test_resume_returns_the_same_page_or_a_fresh_one(): void
    {
        [$renter, $v, $ref, $res] = $this->unpaid();
        $this->as($renter)->postJson("/api/bookings/{$ref}/pay")->assertOk()->assertJsonPath('checkout_url', $res->json('checkout_url'));
        // Once Xendit says the page expired there is no hold left, so there is nothing to resume.
        $this->xendit['session_status'] = 'EXPIRED';
        $this->as($renter)->postJson("/api/bookings/{$ref}/pay")->assertStatus(422)->assertJsonValidationErrors('booking');
        $this->assertSame('cancelled', Booking::where('reference', $ref)->value('status'));
    }

    public function test_cancel_refunds_through_xendit_and_issues_a_refund_receipt(): void
    {
        $renter = $this->verifiedRenter();
        $ref = $this->book($renter, $this->vehicle())->assertCreated()->json('reference');
        $this->as($renter)->postJson("/api/bookings/{$ref}/cancel", ['reason' => 'plans changed'])->assertOk()
            ->assertJsonPath('status', 'cancelled')->assertJsonPath('payment_status', 'refunded');

        $call = collect($this->xendit['calls'])->firstWhere('payment_id', 'py-ps-test-1');
        $this->assertSame(11880, $call['amount']);
        $this->assertSame('CANCELLATION', $call['reason']);
        $refund = Payment::where('type', 'refund')->first();
        $this->assertSame('succeeded', $refund->status);
        $this->assertSame(Payment::where('type', 'charge')->value('id'), $refund->parent_id);
        $this->assertNotNull($refund->provider_refund_id);
        $receipt = Invoice::where('kind', 'refund_receipt')->first();
        $this->assertMatchesRegularExpression('/^BYG-RF-\d{4}-\d{6}$/', $receipt->number);
        $this->assertSame(Invoice::where('kind', 'invoice')->value('number'), $receipt->data['original_invoice']);
    }

    public function test_card_refunds_use_a_reason_xendit_accepts_for_cards(): void
    {
        $renter = $this->verifiedRenter();
        $ref = $this->book($renter, $this->vehicle(), ['payment_method' => 'card'])->assertCreated()->json('reference');
        $this->as($renter)->postJson("/api/bookings/{$ref}/cancel", [])->assertOk();
        $call = collect($this->xendit['calls'])->firstWhere('payment_id', 'py-ps-test-1');
        $this->assertSame('REQUESTED_BY_CUSTOMER', $call['reason']);
    }

    public function test_a_pending_refund_finishes_through_the_webhook(): void
    {
        $renter = $this->verifiedRenter();
        $ref = $this->book($renter, $this->vehicle())->assertCreated()->json('reference');
        $this->xendit['refund_status'] = 'PENDING';
        $this->as($renter)->postJson("/api/bookings/{$ref}/cancel", [])->assertOk();
        $refund = Payment::where('type', 'refund')->first();
        $this->assertSame('pending', $refund->status);
        $this->assertSame(0, Invoice::where('kind', 'refund_receipt')->count());

        $this->xendit['refund_status'] = 'SUCCEEDED';
        $this->webhook(['event' => 'refund.succeeded', 'data' => ['refund_id' => $refund->provider_refund_id]])->assertOk();
        $this->assertSame('succeeded', $refund->fresh()->status);
        $this->assertSame(1, Invoice::where('kind', 'refund_receipt')->count());
        $this->webhook(['event' => 'refund.succeeded', 'data' => ['refund_id' => $refund->provider_refund_id]])->assertOk();
        $this->assertSame(1, Invoice::where('kind', 'refund_receipt')->count());
    }

    public function test_the_scheduled_sweep_settles_pending_payments_and_refunds(): void
    {
        [$renter, $v, $ref] = $this->unpaid();
        $this->xendit['session_status'] = 'COMPLETED';
        $this->artisan('payments:sync')->assertSuccessful();
        $this->assertSame('confirmed', Booking::where('reference', $ref)->value('status'));

        $this->xendit['refund_status'] = 'PENDING';
        $this->as($renter)->postJson("/api/bookings/{$ref}/cancel", [])->assertOk();
        $this->xendit['refund_status'] = 'SUCCEEDED';
        $this->artisan('payments:sync')->assertSuccessful();
        $this->assertSame('succeeded', Payment::where('type', 'refund')->value('status'));
    }

    public function test_a_failed_refund_does_not_block_the_cancellation_and_can_be_retried(): void
    {
        $renter = $this->verifiedRenter();
        $admin = $this->admin();
        $ref = $this->book($renter, $this->vehicle())->assertCreated()->json('reference');
        $this->xendit['fail_refunds'] = true;
        $this->as($renter)->postJson("/api/bookings/{$ref}/cancel", [])->assertOk()->assertJsonPath('status', 'cancelled');

        $refund = Payment::where('type', 'refund')->first();
        $this->assertSame('failed', $refund->status);
        $this->assertNotEmpty($refund->failure_reason);
        $this->assertSame(1, UserNotification::where('user_id', $admin->id)->where('title', 'Refund failed')->count());
        $this->assertSame(0, (int) Payment::where('type', 'refund')->where('status', 'succeeded')->sum('amount'));

        $this->xendit['fail_refunds'] = false;
        $this->as($admin)->postJson("/api/admin/payments/{$refund->id}/retry-refund")->assertOk()->assertJsonPath('status', 'succeeded');
        $this->as($admin)->postJson("/api/admin/payments/{$refund->id}/retry-refund")->assertStatus(422); // only failed ones can be retried
        $this->assertSame(1, Invoice::where('kind', 'refund_receipt')->count());
    }

    public function test_admin_can_mark_a_failed_refund_as_paid_by_hand(): void
    {
        $renter = $this->verifiedRenter();
        $admin = $this->admin();
        $ref = $this->book($renter, $this->vehicle())->assertCreated()->json('reference');
        $this->xendit['fail_refunds'] = true;
        $this->as($renter)->postJson("/api/bookings/{$ref}/cancel", [])->assertOk();
        $refund = Payment::where('type', 'refund')->first();

        $this->as($admin)->postJson("/api/admin/payments/{$refund->id}/mark-refund-handled", ['note' => 'x'])->assertStatus(422);
        $this->as($admin)->postJson("/api/admin/payments/{$refund->id}/mark-refund-handled", ['note' => 'Sent to GCash 0917 by hand'])->assertOk()->assertJsonPath('status', 'succeeded');
        $this->as($renter)->postJson("/api/admin/payments/{$refund->id}/mark-refund-handled", ['note' => 'trying it'])->assertForbidden();
    }

    public function test_admin_partial_refund_is_limited_to_what_was_paid(): void
    {
        $renter = $this->verifiedRenter();
        $admin = $this->admin();
        $ref = $this->book($renter, $this->vehicle())->assertCreated()->json('reference');

        $this->as($admin)->postJson("/api/admin/bookings/{$ref}/refund", ['amount' => 1000, 'reason' => 'Goodwill after a late handover'])->assertOk();
        $call = collect($this->xendit['calls'])->firstWhere('amount', 1000);
        $this->assertSame('py-ps-test-1', $call['payment_id']);
        $this->assertSame('REQUESTED_BY_CUSTOMER', $call['reason']);
        $row = Payment::where('type', 'refund')->first();
        $this->assertSame($admin->id, $row->requested_by);
        $this->assertStringContainsString('Goodwill', $row->reason);

        $this->as($admin)->postJson("/api/admin/bookings/{$ref}/refund", ['amount' => 11000, 'reason' => 'Too much'])->assertStatus(422)->assertJsonValidationErrors('amount');
        $this->as($admin)->postJson("/api/admin/bookings/{$ref}/refund", ['amount' => 10880, 'reason' => 'The rest'])->assertOk();
        $this->assertSame(11880, (int) Payment::where('type', 'refund')->sum('amount'));
    }

    public function test_a_partial_refund_the_provider_refuses_is_reported_and_left_for_retry(): void
    {
        $renter = $this->verifiedRenter();
        $admin = $this->admin();
        $ref = $this->book($renter, $this->vehicle())->assertCreated()->json('reference');
        $this->xendit['fail_refunds'] = true;

        $this->as($admin)->postJson("/api/admin/bookings/{$ref}/refund", ['amount' => 500, 'reason' => 'Goodwill'])
            ->assertStatus(422)->assertJsonValidationErrors('amount');
        $this->assertSame('paid', Booking::where('reference', $ref)->value('payment_status')); // nothing was refunded, so nothing changes
        $row = Payment::where('type', 'refund')->first();
        $this->assertSame('failed', $row->status);
        $this->assertSame(11880, $this->app->make(\App\Services\PaymentService::class)->refundable(Booking::first())); // a failed refund frees the amount

        $this->xendit['fail_refunds'] = false;
        $this->as($admin)->postJson("/api/admin/payments/{$row->id}/retry-refund")->assertOk()->assertJsonPath('status', 'succeeded');
    }

    public function test_invoice_pdf_is_numbered_private_and_downloadable(): void
    {
        $renter = $this->verifiedRenter();
        $this->book($renter, $this->vehicle())->assertCreated();
        $p = Payment::where('type', 'charge')->first();
        $invoice = Invoice::first();
        $this->assertMatchesRegularExpression('/^BYG-\d{4}-\d{6}$/', $invoice->number);
        $this->assertSame(11880, array_sum(array_column($invoice->data['items'], 'amount')));
        $this->assertSame('System-generated invoice. Not a BIR-registered official receipt.', $invoice->data['note']);
        $labels = implode('|', array_column($invoice->data['items'], 'label'));
        $this->assertStringContainsString('Security deposit (refundable)', $labels);

        $r = $this->as($renter)->get("/api/payments/{$p->id}/invoice.pdf")->assertOk();
        $this->assertSame('application/pdf', $r->headers->get('Content-Type'));
        $this->assertStringStartsWith('%PDF', $r->getContent());
        $this->as($this->verifiedRenter())->get("/api/payments/{$p->id}/invoice.pdf")->assertNotFound();
        $this->as($this->admin())->get("/api/admin/payments/{$p->id}/invoice.pdf")->assertOk();
        $this->as($renter)->get("/api/admin/payments/{$p->id}/invoice.pdf")->assertForbidden();

        // The printed copy is frozen: editing the booking later does not rewrite it.
        Booking::query()->update(['service_fee' => 1]);
        $this->assertSame(11880, array_sum(array_column($invoice->fresh()->data['items'], 'amount')));
    }

    public function test_invoice_numbers_run_in_order_without_repeating(): void
    {
        $a = $this->verifiedRenter();
        $this->book($a, $this->vehicle())->assertCreated();
        $this->book($a, $this->vehicle())->assertCreated();
        $numbers = Invoice::orderBy('id')->pluck('number')->all();
        $this->assertCount(2, array_unique($numbers));
        $this->assertGreaterThan((int) substr($numbers[0], -6), (int) substr($numbers[1], -6));
    }

    public function test_billing_history_filters_pages_and_summarises(): void
    {
        $renter = $this->verifiedRenter();
        $ref = $this->book($renter, $this->vehicle())->assertCreated()->json('reference');
        $this->book($renter, $this->vehicle())->assertCreated();
        $this->as($renter)->postJson("/api/bookings/{$ref}/cancel", [])->assertOk();

        $all = $this->as($renter)->getJson('/api/me/billing')->assertOk();
        $all->assertJsonPath('summary.total_paid', 23760)->assertJsonPath('summary.total_refunded', 11880)->assertJsonPath('meta.total', 3);
        $this->assertNotNull($all->json('data.0.booking_reference'));
        $this->as($renter)->getJson('/api/me/billing?type=refunds')->assertJsonPath('meta.total', 1);
        $this->as($renter)->getJson('/api/me/billing?type=payments&status=succeeded')->assertJsonPath('meta.total', 2);
        $this->as($renter)->getJson('/api/me/billing?from='.now()->addDay()->toDateString())->assertJsonPath('meta.total', 0);
        // Other people's lines never show up.
        $this->as($this->verifiedRenter())->getJson('/api/me/billing')->assertJsonPath('meta.total', 0);
    }

    public function test_provider_ids_are_visible_to_admin_only(): void
    {
        $renter = $this->verifiedRenter();
        $ref = $this->book($renter, $this->vehicle())->assertCreated()->json('reference');
        $admin = $this->admin();
        $this->as($renter)->getJson("/api/bookings/{$ref}")->assertJsonMissingPath('payments.0.provider_payment_id');
        $this->as($admin)->getJson("/api/admin/bookings/{$ref}")->assertJsonPath('payments.0.provider_payment_id', 'py-ps-test-1');
        $this->as($admin)->getJson('/api/admin/payments?status=succeeded')->assertOk()->assertJsonPath('summary.collected', 11880);
    }

    public function test_unconfigured_gateway_drops_the_booking_with_a_clear_message(): void
    {
        config(['services.xendit.secret' => '']);
        Http::preventStrayRequests();
        $this->book($this->verifiedRenter(), $this->vehicle())->assertStatus(422)->assertJsonValidationErrors('payment');
        $this->assertSame('cancelled', Booking::first()->status);
    }

    public function test_a_failing_invoice_never_undoes_a_paid_booking_and_is_repaired_later(): void
    {
        $this->app->bind(\App\Services\InvoiceService::class, fn () => new class extends \App\Services\InvoiceService {
            public static bool $broken = true;
            public function issueFor(\App\Models\Payment $payment): ?\App\Models\Invoice
            {
                if (self::$broken) throw new \RuntimeException('printer on fire');
                return parent::issueFor($payment);
            }
        });
        $renter = $this->verifiedRenter();
        $this->book($renter, $this->vehicle())->assertCreated()->assertJsonPath('status', 'confirmed')->assertJsonPath('payments.0.invoice_no', null);
        $this->assertSame(0, Invoice::count());

        $cls = get_class(app(\App\Services\InvoiceService::class));
        $cls::$broken = false;
        $this->artisan('payments:sync')->assertSuccessful();
        $this->assertSame(1, Invoice::count());
    }
}
