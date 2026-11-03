<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('purpose', 30); // vehicle_photo | license_front | license_back | selfie | vehicle_or | vehicle_cr | incident | inspection
            $table->string('visibility', 10)->default('private'); // public | private
            $table->string('mime', 50);
            $table->unsignedInteger('size');
            $table->unsignedInteger('width')->nullable();
            $table->unsignedInteger('height')->nullable();
            $table->string('sha1', 40)->index();
            $table->longText('data'); // base64 encoded, so uploads survive redeploys on ephemeral hosts
            $table->timestamps();
        });

        Schema::create('hubs', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('address');
            $table->string('city');
            $table->decimal('lat', 10, 7);
            $table->decimal('lng', 10, 7);
            $table->string('hours')->default('7:00 AM – 10:00 PM');
            $table->string('parking_notes')->nullable();
            $table->timestamps();
        });

        Schema::create('vehicles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('host_id')->constrained('users')->cascadeOnDelete();
            $table->string('make');
            $table->string('model');
            $table->unsignedSmallInteger('year');
            $table->string('type', 20); // sedan | hatchback | suv | mpv | van | pickup | motorcycle
            $table->string('transmission', 20); // automatic | manual
            $table->string('fuel', 20); // gasoline | diesel | hybrid | electric
            $table->unsignedTinyInteger('seats');
            $table->string('color')->nullable();
            $table->string('color_hex', 7)->default('#0D7C6B');
            $table->string('plate_number', 20)->nullable();
            $table->text('description')->nullable();
            $table->json('features')->nullable();
            $table->unsignedInteger('daily_rate')->default(0);
            $table->unsignedInteger('weekly_rate')->nullable();
            $table->boolean('with_driver_available')->default(false);
            $table->unsignedInteger('driver_fee_per_day')->default(0);
            $table->boolean('instant_book')->default(true);
            $table->boolean('delivery_available')->default(false);
            $table->unsignedInteger('delivery_fee')->default(0);
            $table->boolean('pet_friendly')->default(false);
            $table->unsignedTinyInteger('min_days')->default(1);
            $table->unsignedInteger('security_deposit')->default(3000);
            $table->unsignedInteger('late_fee_per_hour')->default(300);
            $table->string('pickup_type', 10)->default('hub'); // hub | own
            $table->foreignId('hub_id')->nullable()->constrained('hubs')->nullOnDelete();
            $table->string('pickup_address')->nullable();
            $table->string('city')->nullable();
            $table->decimal('lat', 10, 7)->nullable();
            $table->decimal('lng', 10, 7)->nullable();
            $table->foreignId('or_media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->foreignId('cr_media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->string('status', 20)->default('draft'); // draft | pending | live | rejected | paused
            $table->string('rejection_reason')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->decimal('rating_avg', 3, 2)->default(0);
            $table->unsignedInteger('rating_count')->default(0);
            $table->unsignedInteger('trips_count')->default(0);
            $table->timestamps();
            $table->index(['status', 'type']);
        });

        Schema::create('vehicle_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
            $table->foreignId('media_id')->constrained('media')->cascadeOnDelete();
            $table->unsignedTinyInteger('position')->default(0);
            $table->timestamps();
        });

        Schema::create('driver_licenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('license_type', 10)->default('ph'); // ph | foreign
            $table->string('license_number', 40);
            $table->string('full_name');
            $table->date('birthdate');
            $table->date('expiry_date');
            $table->string('address')->nullable();
            $table->string('nationality')->nullable();
            $table->json('restriction_codes')->nullable();
            $table->foreignId('front_media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->foreignId('back_media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->foreignId('selfie_media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->string('status', 20)->default('pending'); // pending | approved | rejected | revoked
            $table->unsignedTinyInteger('auto_score')->default(0);
            $table->json('auto_checks')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->string('rejection_reason')->nullable();
            $table->timestamps();
        });

        Schema::create('host_applications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('full_name');
            $table->string('phone', 30);
            $table->string('city');
            $table->string('address')->nullable();
            $table->unsignedSmallInteger('vehicle_count')->default(1);
            $table->json('vehicle_types')->nullable();
            $table->string('business_name')->nullable();
            $table->string('payout_method', 20);
            $table->string('payout_account_name');
            $table->string('payout_account_number');
            $table->text('notes')->nullable();
            $table->string('status', 20)->default('pending'); // pending | approved | rejected
            $table->string('admin_notes')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('bookings', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 20)->unique();
            $table->foreignId('renter_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
            $table->foreignId('host_id')->constrained('users')->cascadeOnDelete();
            $table->dateTime('pickup_at');
            $table->dateTime('return_at');
            $table->string('rental_type', 10)->default('self'); // self | driver
            $table->string('protection_plan', 20)->default('standard');
            $table->unsignedSmallInteger('days');
            $table->unsignedInteger('daily_rate');
            $table->unsignedInteger('rental_subtotal');
            $table->unsignedInteger('driver_fee_total')->default(0);
            $table->unsignedInteger('protection_total')->default(0);
            $table->unsignedInteger('service_fee')->default(0);
            $table->unsignedInteger('total');
            $table->unsignedInteger('security_deposit')->default(0);
            $table->unsignedInteger('amount_paid')->default(0);
            $table->string('status', 20)->default('confirmed'); // confirmed | active | completed | cancelled
            $table->string('payment_status', 20)->default('paid'); // paid | refunded | partially_refunded | balance_due
            $table->string('deposit_status', 20)->default('held'); // held | on_hold | released | partially_released | applied | refunded
            $table->string('pickup_label');
            $table->decimal('pickup_lat', 10, 7)->nullable();
            $table->decimal('pickup_lng', 10, 7)->nullable();
            $table->string('driver_name');
            $table->string('driver_phone', 30)->nullable();
            $table->string('driver_email')->nullable();
            $table->string('driver_license_no', 40)->nullable();
            $table->string('payment_method', 20);
            $table->timestamp('agreement_accepted_at')->nullable();
            $table->string('agreement_version', 10)->nullable();
            $table->string('agreement_ip', 45)->nullable();
            $table->dateTime('actual_pickup_at')->nullable();
            $table->dateTime('actual_return_at')->nullable();
            $table->unsignedSmallInteger('late_hours')->default(0);
            $table->unsignedInteger('late_fee')->default(0);
            $table->unsignedInteger('damage_charge')->default(0);
            $table->unsignedInteger('balance_due')->default(0);
            $table->unsignedInteger('deposit_refunded')->default(0);
            $table->unsignedInteger('commission')->default(0);
            $table->unsignedInteger('host_earnings')->default(0);
            $table->timestamp('settled_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->string('cancelled_by', 10)->nullable(); // renter | admin | system
            $table->string('cancel_reason')->nullable();
            $table->text('admin_note')->nullable();
            $table->timestamps();
            $table->index(['vehicle_id', 'status', 'pickup_at', 'return_at']);
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type', 20); // charge | refund | late_fee | damage | balance
            $table->string('method', 20); // gcash | maya | card | google_pay | apple_pay | deposit
            $table->unsignedInteger('amount');
            $table->string('status', 20)->default('succeeded');
            $table->string('receipt_no', 30)->unique();
            $table->string('gateway_ref', 60)->nullable();
            $table->string('account_hint', 40)->nullable(); // e.g. •••• 4242 or 0917 ••• 4567
            $table->string('description');
            $table->timestamps();
        });

        Schema::create('booking_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('type', 30);
            $table->string('message');
            $table->timestamps();
        });

        Schema::create('inspections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->string('stage', 10); // pickup | return
            $table->unsignedInteger('odometer');
            $table->unsignedTinyInteger('fuel_level'); // percent
            $table->json('checklist');
            $table->text('notes')->nullable();
            $table->json('photo_ids')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('incidents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->foreignId('reporter_id')->constrained('users')->cascadeOnDelete();
            $table->string('type', 30); // damage | theft | missing_parts | accident | traffic_violation | other
            $table->text('description');
            $table->unsignedInteger('amount_claimed')->default(0);
            $table->json('photo_ids')->nullable();
            $table->string('status', 20)->default('open'); // open | resolved | dismissed
            $table->unsignedInteger('amount_approved')->default(0);
            $table->text('resolution_notes')->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
        });

        Schema::create('reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
            $table->foreignId('renter_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedTinyInteger('rating');
            $table->text('comment')->nullable();
            $table->timestamps();
        });

        Schema::create('favorites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
            $table->boolean('price_alert')->default(false);
            $table->timestamps();
            $table->unique(['user_id', 'vehicle_id']);
        });

        Schema::create('recently_viewed', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
            $table->timestamp('viewed_at');
            $table->unique(['user_id', 'vehicle_id']);
        });

        Schema::create('payouts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('host_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('booking_id')->unique()->constrained()->cascadeOnDelete();
            $table->unsignedInteger('amount');
            $table->string('status', 20)->default('scheduled'); // scheduled | paid
            $table->date('scheduled_for');
            $table->timestamp('paid_at')->nullable();
            $table->string('reference', 40)->nullable();
            $table->timestamps();
        });

        Schema::create('user_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->string('body');
            $table->string('link')->nullable();
            $table->string('kind', 20)->default('info'); // info | success | warning | danger
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });

        Schema::create('support_tickets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('email');
            $table->string('topic', 30);
            $table->string('booking_reference', 20)->nullable();
            $table->text('message');
            $table->string('status', 20)->default('open'); // open | closed
            $table->text('reply')->nullable();
            $table->timestamps();
        });

        Schema::create('settings', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->string('value');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['settings', 'support_tickets', 'user_notifications', 'payouts', 'recently_viewed', 'favorites', 'reviews', 'incidents',
            'inspections', 'booking_events', 'payments', 'bookings', 'host_applications', 'driver_licenses', 'vehicle_photos',
            'vehicles', 'hubs', 'media'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
