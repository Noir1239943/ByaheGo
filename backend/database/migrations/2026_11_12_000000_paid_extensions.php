<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // An approved extension now has a price and a payment. status: pending (host to decide) | awaiting_payment | approved (paid)
        // | declined | lapsed (not paid before the original return time).
        Schema::table('booking_extensions', function (Blueprint $table) {
            $table->unsignedInteger('amount')->default(0)->after('requested_return_at');
            $table->unsignedSmallInteger('hours')->default(0)->after('amount');
            $table->foreignId('payment_id')->nullable()->after('hours')->constrained('payments')->nullOnDelete();
        });
        Schema::table('booking_extensions', fn (Blueprint $table) => $table->string('status', 16)->default('pending')->change());
    }

    public function down(): void
    {
        Schema::table('booking_extensions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('payment_id');
            $table->dropColumn(['amount', 'hours']);
        });
    }
};
