<?php

namespace App\Mail;

use App\Models\Booking;
use App\Models\Invoice;
use App\Models\User;
use App\Services\AgreementService;
use App\Services\InvoiceService;
use App\Support\Settings;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** Sent to the renter and the host when a booking is confirmed, with the signed agreement attached. */
class BookingConfirmedMail extends Mailable
{
    public function __construct(public Booking $booking, public User $recipient, public bool $forHost = false, public ?Invoice $invoice = null) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: "Booking confirmed: {$this->booking->reference}");
    }

    public function content(): Content
    {
        $agreements = app(AgreementService::class);
        return new Content(view: 'emails.booking-confirmed', with: [
            'booking' => $this->booking,
            'recipient' => $this->recipient,
            'forHost' => $this->forHost,
            'invoice' => $this->invoice,
            'freeUntil' => $agreements->when($this->booking->pickup_at->copy()->subHours((int) Settings::get('cancellation_cutoff_hours'))),
        ]);
    }

    public function attachments(): array
    {
        $files = [];
        if ($this->booking->agreement()->exists()) {
            $files[] = Attachment::fromData(fn () => app(AgreementService::class)->pdf($this->booking), "ByaheGo-agreement-{$this->booking->reference}.pdf")->withMime('application/pdf');
        }
        if ($this->invoice) {
            $files[] = Attachment::fromData(fn () => app(InvoiceService::class)->pdf($this->invoice), "ByaheGo-{$this->invoice->number}.pdf")->withMime('application/pdf');
        }
        return $files;
    }
}
