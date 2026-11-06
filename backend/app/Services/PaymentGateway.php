<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Xendit, using hosted checkout (Payment Sessions) and the v3 Refunds API. Card and wallet details are typed on
 * Xendit's own page and never touch this server. Amounts are whole pesos, which is also what Xendit expects for PHP.
 *
 * Google Pay is not offered yet: Xendit supports it in the Philippines, but it needs Google Pay enabled on our Xendit account and a
 * Google merchant ID, which our test setup doesn't have. Apple Pay is not offered. Neither is faked.
 */
class PaymentGateway
{
    /** What the renter picks at checkout => the label shown everywhere. */
    public const METHODS = [
        'gcash' => 'GCash',
        'maya' => 'Maya',
        'card' => 'Credit or debit card',
        'qrph' => 'QR Ph',
        'grabpay' => 'GrabPay',
        'shopeepay' => 'ShopeePay',
    ];

    /** Our method => Xendit's channel code (verified against the live API). */
    public const CHANNELS = [
        'gcash' => 'GCASH',
        'maya' => 'PAYMAYA',
        'card' => 'CARDS',
        'qrph' => 'QRPH',
        'grabpay' => 'GRABPAY',
        'shopeepay' => 'SHOPEEPAY',
    ];

    /** Labels for older records made before the Xendit switch. */
    private const OLD = ['google_pay' => 'Google Pay', 'apple_pay' => 'Apple Pay', 'deposit' => 'Security deposit'];

    public static function label(?string $method): string
    {
        return self::METHODS[$method] ?? self::OLD[$method] ?? ($method ?: '');
    }

    public function configured(): bool
    {
        return (string) config('services.xendit.secret') !== '';
    }

    /** @return array{id:string,url:string,expires_at:?string} */
    public function createSession(string $referenceId, int $amount, string $description, string $method, string $successUrl, string $cancelUrl): array
    {
        $r = $this->call(fn (PendingRequest $h) => $h->post('/sessions', [
            'reference_id' => $referenceId,
            'session_type' => 'PAY',
            'mode' => 'PAYMENT_LINK',
            'amount' => $amount,
            'currency' => 'PHP',
            'country' => 'PH',
            'description' => mb_substr($description, 0, 200),
            'allowed_payment_channels' => [self::CHANNELS[$method]],
            'locale' => 'en',
            'success_return_url' => $successUrl,
            'cancel_return_url' => $cancelUrl,
        ]));
        return ['id' => $r['payment_session_id'], 'url' => $r['payment_link_url'], 'expires_at' => $r['expires_at'] ?? null];
    }

    /** @return array{id:string,status:string,payment_id:?string,url:?string} status is paid | pending | expired | canceled */
    public function retrieveSession(string $sessionId): array
    {
        $r = $this->call(fn (PendingRequest $h) => $h->get('/sessions/'.$sessionId));
        $status = match (strtoupper((string) ($r['status'] ?? ''))) {
            'COMPLETED' => 'paid',
            'EXPIRED' => 'expired',
            'CANCELED', 'CANCELLED' => 'canceled',
            default => 'pending',
        };
        // A completed session without a payment id is not trusted as paid: we need the id to refund it later.
        if ($status === 'paid' && empty($r['payment_id'])) $status = 'pending';
        return ['id' => $sessionId, 'status' => $status, 'payment_id' => $r['payment_id'] ?? null, 'url' => $r['payment_link_url'] ?? null];
    }

    public function cancelSession(string $sessionId): void
    {
        try {
            $this->call(fn (PendingRequest $h) => $h->post('/sessions/'.$sessionId.'/cancel'));
        } catch (PaymentGatewayException) {
            // The hold on our side is what matters; an already finished session can't be cancelled and that is fine.
        }
    }

    /**
     * Partial refunds are supported. Xendit answers PENDING first and finishes later (webhook, or we ask again).
     *
     * @return array{id:string,status:string,failure:?string} status is pending | succeeded | failed
     */
    public function refund(string $paymentId, int $amount, string $referenceId, string $reason = 'OTHERS'): array
    {
        $r = $this->call(fn (PendingRequest $h) => $h->withHeaders(['api-version' => '2024-11-11'])->post('/v3/refunds', [
            'reference_id' => $referenceId,
            'payment_id' => $paymentId,
            'amount' => $amount,
            'reason' => $reason,
        ]));
        return $this->refundResult($r);
    }

    public function retrieveRefund(string $refundId): array
    {
        return $this->refundResult($this->call(fn (PendingRequest $h) => $h->withHeaders(['api-version' => '2024-11-11'])->get('/v3/refunds/'.$refundId)));
    }

    protected function refundResult(array $r): array
    {
        $status = match (strtoupper((string) ($r['status'] ?? ''))) {
            'SUCCEEDED' => 'succeeded',
            'FAILED' => 'failed',
            default => 'pending',
        };
        return ['id' => $r['refund_id'] ?? $r['id'] ?? '', 'status' => $status, 'failure' => $r['failure_code'] ?? null];
    }

    protected function call(callable $fn): array
    {
        if (! $this->configured()) throw new PaymentGatewayException('Online payments are not set up yet.');
        try {
            /** @var Response $res */
            $http = Http::baseUrl(rtrim((string) config('services.xendit.base_url'), '/'))->withBasicAuth((string) config('services.xendit.secret'), '')->acceptJson()->asJson()->timeout(25);
            if ($bundle = config('services.xendit.ca_bundle')) $http = $http->withOptions(['verify' => $bundle]);
            $res = $fn($http);
        } catch (\Throwable $e) {
            Log::warning('Xendit connection problem: '.$e->getMessage());
            throw new PaymentGatewayException('We could not reach the payment provider. Please try again.', previous: $e);
        }
        if (! $res->successful()) {
            // Xendit's message is logged for us; the renter only sees a safe, plain sentence.
            throw new PaymentGatewayException((string) ($res->json('message') ?: 'The payment provider refused the request.'), (string) $res->json('error_code'), $res->status());
        }
        return (array) $res->json();
    }
}
