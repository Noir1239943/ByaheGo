<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // status: active | suspended (temporary, ends at suspended_until) | revoked (permanent)
            $table->timestamp('suspended_until')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->foreignId('blocked_by')->nullable()->constrained('users')->nullOnDelete();
        });

        Schema::table('bookings', function (Blueprint $table) {
            // Set when the renter or host is blocked, so an admin can decide what happens to the trip.
            $table->string('admin_flag', 30)->nullable()->index(); // renter_blocked | host_blocked
            $table->string('admin_flag_note')->nullable();
            $table->timestamp('flagged_at')->nullable();
        });

        Schema::create('admin_audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 40)->index(); // e.g. user.suspend, verification.approve, booking.cancel
            $table->string('target_type', 30)->nullable();
            $table->unsignedBigInteger('target_id')->nullable();
            $table->string('target_label')->nullable();
            $table->text('reason')->nullable();
            $table->json('meta')->nullable();
            $table->string('ip', 45)->nullable();
            $table->timestamp('created_at')->useCurrent()->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_audit_logs');
        Schema::table('bookings', fn (Blueprint $table) => $table->dropColumn(['admin_flag', 'admin_flag_note', 'flagged_at']));
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('blocked_by');
            $table->dropColumn(['suspended_until', 'revoked_at']);
        });
    }
};
