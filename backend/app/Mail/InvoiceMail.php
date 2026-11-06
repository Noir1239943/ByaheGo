<?php

namespace App\Mail;

use App\Models\Invoice;
use App\Models\User;
use App\Services\InvoiceService;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** A copy of an invoice or refund receipt, sent to the renter with the PDF attached. */
class InvoiceMail extends Mailable
{
    public function __construct(public Invoice $invoice, public User $recipient) {}

    public function envelope(): Envelope
    {
        $what = $this->invoice->kind === 'invoice' ? 'invoice' : 'refund receipt';
        return new Envelope(subject: "Your ByaheGo {$what} {$this->invoice->number}");
    }

    public function content(): Content
    {
        return new Content(view: 'emails.invoice', with: ['invoice' => $this->invoice, 'd' => $this->invoice->data, 'recipient' => $this->recipient]);
    }

    public function attachments(): array
    {
        return [Attachment::fromData(fn () => app(InvoiceService::class)->pdf($this->invoice), "ByaheGo-{$this->invoice->number}.pdf")->withMime('application/pdf')];
    }
}
