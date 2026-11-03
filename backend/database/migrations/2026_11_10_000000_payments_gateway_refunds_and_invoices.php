<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->string('provider', 20)->nullable()->after('method'); // xendit (null = recorded by hand / older test data)
            $table->string('provider_session_id', 80)->nullable()->index()->after('gateway_ref');
            $table->string('checkout_url', 255)->nullable()->after('provider_session_id'); // the hosted payment page, kept so a renter can come back to it
            $table->string('provider_payment_id', 80)->nullable()->index()->after('provider_session_id');
            $table->string('provider_refund_id', 80)->nullable()->index()->after('provider_payment_id');
            $table->foreignId('parent_id')->nullable()->after('booking_id')->constrained('payments')->nullOnDelete(); // a refund points at the payment it returns money from
            $table->json('items')->nullable()->after('description'); // line items shown on the invoice
            $table->string('reason', 255)->nullable()->after('items'); // refunds: why
            $table->foreignId('requested_by')->nullable()->after('reason')->constrained('users')->nullOnDelete();
            $table->foreignId('processed_by')->nullable()->after('requested_by')->constrained('users')->nullOnDelete();
            $table->string('failure_reason', 255)->nullable()->after('processed_by');
            $table->unsignedTinyInteger('attempts')->default(0)->after('failure_reason');
            $table->timestamp('paid_at')->nullable()->after('attempts');
        });

        // One invoice per successful payment and one refund receipt per refund. The numbers run in order and never repeat.
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->string('number', 30)->unique(); // BYG-2026-000123
            $table->string('kind', 20); // invoice | refund_receipt
            $table->foreignId('payment_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('invoices')->nullOnDelete(); // a refund receipt points at the invoice it refunds
            $table->json('data'); // frozen copy of everything printed, so later edits never change an issued invoice
            $table->timestamp('issued_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoices');
        Schema::table('payments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('parent_id');
            $table->dropConstrainedForeignId('requested_by');
            $table->dropConstrainedForeignId('processed_by');
            $table->dropColumn(['provider', 'provider_session_id', 'checkout_url', 'provider_payment_id', 'provider_refund_id', 'items', 'reason', 'failure_reason', 'attempts', 'paid_at']);
        });
    }
};
