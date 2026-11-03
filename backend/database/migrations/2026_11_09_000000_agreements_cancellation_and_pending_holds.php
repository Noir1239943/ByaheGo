<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The exact text a renter e-signed, kept as it was when they signed it.
        Schema::create('booking_agreements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('version', 10);
            $table->longText('text');
            $table->char('hash', 64);
            $table->string('signer_name');
            $table->timestamp('signed_at');
            $table->string('ip', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->boolean('read_to_end')->default(false);
            $table->timestamps();
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->timestamp('expires_at')->nullable()->after('status'); // unpaid pending bookings hold the dates until then
            $table->unsignedInteger('cancellation_fee')->default(0)->after('cancel_reason');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->unsignedInteger('host_cancellations')->default(0)->after('is_super_admin');
        });
    }

    public function down(): void
    {
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('host_cancellations'));
        Schema::table('bookings', fn (Blueprint $table) => $table->dropColumn(['expires_at', 'cancellation_fee']));
        Schema::dropIfExists('booking_agreements');
    }
};
