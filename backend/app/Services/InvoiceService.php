<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\Payment;
use App\Support\Money;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Str;

/**
 * A PDF invoice for every payment that went through and a refund receipt for every refund that was paid out.
 * What gets printed is frozen into `invoices.data` when the invoice is issued, so later changes never rewrite it.
 * These are system-generated documents, not BIR-registered official receipts.
 */
class InvoiceService
{
    public const NOTE = 'System-generated invoice. Not a BIR-registered official receipt.';

    public function issueFor(Payment $payment): ?Invoice
    {
        if ($payment->invoice()->exists()) return $payment->invoice;
        if ($payment->type === 'refund') return $payment->status === 'succeeded' ? $this->issueRefundReceipt($payment) : null;
        if (! $payment->isMoneyIn()) return null;

        $payment->loadMissing(['booking.vehicle', 'booking.renter']);
        $b = $payment->booking;
        return $this->create('invoice', $payment, null, [
            'title' => 'Invoice',
            'items' => $payment->items ?: [['label' => $payment->description, 'amount' => $payment->amount]],
            'total' => $payment->amount,
            'method' => PaymentGateway::label($payment->method),
            'paid_at' => ($payment->paid_at ?? now())->toIso8601String(),
            'payment_reference' => $payment->provider_payment_id ?: $payment->receipt_no,
            'receipt_no' => $payment->receipt_no,
            'booking' => $this->bookingBlock($b),
            'renter' => ['name' => $b->renter->name, 'email' => $b->renter->email, 'phone' => $b->renter->phone],
        ]);
    }

    public function issueRefundReceipt(Payment $refund): Invoice
    {
        if ($refund->invoice()->exists()) return $refund->invoice;
        $refund->loadMissing(['booking.vehicle', 'booking.renter', 'parent.invoice']);
        $b = $refund->booking;
        $original = $refund->parent?->invoice ?? ($refund->parent ? $this->issueFor($refund->parent) : null);
        return $this->create('refund_receipt', $refund, $original, [
            'title' => 'Refund receipt',
            'items' => [['label' => $refund->description, 'amount' => $refund->amount]],
            'total' => $refund->amount,
            'method' => PaymentGateway::label($refund->method),
            'paid_at' => ($refund->paid_at ?? now())->toIso8601String(),
            'payment_reference' => $refund->provider_refund_id ?: $refund->receipt_no,
            'receipt_no' => $refund->receipt_no,
            'original_invoice' => $original?->number,
            'reason' => $refund->reason,
            'booking' => $this->bookingBlock($b),
            'renter' => ['name' => $b->renter->name, 'email' => $b->renter->email, 'phone' => $b->renter->phone],
        ]);
    }

    protected function create(string $kind, Payment $payment, ?Invoice $parent, array $data): Invoice
    {
        $invoice = Invoice::create([
            'number' => 'tmp-'.Str::random(20), 'kind' => $kind, 'payment_id' => $payment->id, 'booking_id' => $payment->booking_id,
            'parent_id' => $parent?->id, 'data' => $data + ['seller' => $this->seller(), 'note' => self::NOTE], 'issued_at' => now(),
        ]);
        // The number comes from the row id, so it is sequential and can't repeat even when two payments land together.
        $invoice->update(['number' => sprintf($kind === 'invoice' ? 'BYG-%s-%06d' : 'BYG-RF-%s-%06d', now()->format('Y'), $invoice->id)]);
        return $invoice;
    }

    protected function bookingBlock($b): array
    {
        return [
            'reference' => $b->reference, 'vehicle' => $b->vehicle->name, 'plate' => $b->vehicle->plate_number,
            'pickup_at' => $b->pickup_at->toIso8601String(), 'return_at' => $b->return_at->toIso8601String(), 'days' => $b->days,
        ];
    }

    protected function seller(): array
    {
        return [
            'name' => 'ByaheGo',
            'tagline' => 'Peer-to-peer car rental · Cebu, Philippines',
            'email' => 'support@byahego.ph',
        ];
    }

    /** Line items of a trip payment: exactly what the renter was charged, with the deposit shown as refundable. */
    public static function tripItems($b): array
    {
        $items = [['label' => "Car rental · {$b->days} day(s) × ".Money::peso($b->daily_rate), 'amount' => (int) $b->rental_subtotal]];
        if ($b->driver_fee_total > 0) $items[] = ['label' => 'Driver service', 'amount' => (int) $b->driver_fee_total];
        if ($b->protection_total > 0) $items[] = ['label' => 'Protection plan ('.ucfirst($b->protection_plan).')', 'amount' => (int) $b->protection_total];
        if ($b->service_fee > 0) $items[] = ['label' => 'Service fee', 'amount' => (int) $b->service_fee];
        if ($b->security_deposit > 0) $items[] = ['label' => 'Security deposit (refundable)', 'amount' => (int) $b->security_deposit];
        return $items;
    }

    public function pdf(Invoice $invoice): string
    {
        return Pdf::loadView('pdf.invoice', ['invoice' => $invoice, 'd' => $invoice->data])
            ->setPaper('a4')->setOption(['enable_font_subsetting' => true])->output();
    }

    public function download(Invoice $invoice)
    {
        return response($this->pdf($invoice), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="ByaheGo-'.$invoice->number.'.pdf"',
            'Cache-Control' => 'private, no-store',
        ]);
    }
}
