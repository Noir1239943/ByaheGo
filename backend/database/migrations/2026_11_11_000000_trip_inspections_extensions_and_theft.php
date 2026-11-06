<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Every photo of a check-in or check-out. A row is a "draft" until its inspection is submitted; after that it never changes.
        Schema::create('inspection_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->foreignId('inspection_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('stage', 10); // checkin | checkout
            $table->string('angle', 20); // front | rear | driver_side | passenger_side | dashboard | back_seats | trunk | engine | odometer | fuel | damage | host_extra
            $table->foreignId('media_id')->constrained('media')->cascadeOnDelete();
            $table->foreignId('uploader_id')->constrained('users')->cascadeOnDelete();
            $table->boolean('live')->default(false); // taken with the live camera (false = uploaded from the gallery)
            $table->timestamp('device_time')->nullable(); // the phone's clock when the photo was taken
            $table->decimal('lat', 10, 7)->nullable();
            $table->decimal('lng', 10, 7)->nullable();
            $table->string('sha256', 64);
            $table->string('note', 255)->nullable();
            $table->timestamps(); // created_at = server time
            $table->index(['booking_id', 'stage']);
        });

        Schema::table('inspections', function (Blueprint $table) {
            $table->timestamp('submitted_at')->nullable()->after('recorded_by');
            $table->string('host_status', 20)->nullable()->after('submitted_at'); // check-in only: pending | confirmed | auto_accepted
            $table->text('host_notes')->nullable()->after('host_status');
            $table->timestamp('host_responded_at')->nullable()->after('host_notes');
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->timestamp('checkout_submitted_at')->nullable()->after('actual_return_at'); // renter finished the return photos
            $table->timestamp('host_review_due_at')->nullable()->after('checkout_submitted_at'); // host decides by then, or it completes by itself
            $table->timestamp('return_reminder_sent_at')->nullable()->after('host_review_due_at');
        });

        Schema::table('incidents', function (Blueprint $table) {
            $table->json('pins')->nullable()->after('photo_ids'); // [{angle, x, y, note}] marked on the return photos
            $table->decimal('lat', 10, 7)->nullable()->after('pins');
            $table->decimal('lng', 10, 7)->nullable()->after('lat');
        });

        Schema::create('booking_extensions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->timestamp('previous_return_at');
            $table->timestamp('requested_return_at');
            $table->string('status', 12)->default('pending'); // pending | approved | declined
            $table->string('note', 255)->nullable();
            $table->foreignId('responded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('responded_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_extensions');
        Schema::table('incidents', fn (Blueprint $table) => $table->dropColumn(['pins', 'lat', 'lng']));
        Schema::table('bookings', fn (Blueprint $table) => $table->dropColumn(['checkout_submitted_at', 'host_review_due_at', 'return_reminder_sent_at']));
        Schema::table('inspections', fn (Blueprint $table) => $table->dropColumn(['submitted_at', 'host_status', 'host_notes', 'host_responded_at']));
        Schema::dropIfExists('inspection_photos');
    }
};
