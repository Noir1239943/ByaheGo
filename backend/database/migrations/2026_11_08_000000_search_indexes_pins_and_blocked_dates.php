<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->string('area', 120)->nullable()->after('city'); // barangay / neighbourhood shown publicly instead of the street address
            $table->index(['status', 'daily_rate'], 'vehicles_status_rate_index');
            $table->index(['status', 'transmission'], 'vehicles_status_transmission_index');
            $table->index(['status', 'fuel'], 'vehicles_status_fuel_index');
            $table->index(['status', 'seats'], 'vehicles_status_seats_index');
            $table->index(['status', 'city'], 'vehicles_status_city_index');
            $table->index(['lat', 'lng'], 'vehicles_lat_lng_index');
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->index(['vehicle_id', 'status', 'pickup_at', 'return_at'], 'bookings_vehicle_window_index');
        });

        // Days a host has switched a car off (whole days, both ends included).
        Schema::create('vehicle_blocked_dates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
            $table->date('starts_on');
            $table->date('ends_on');
            $table->string('reason', 120)->nullable();
            $table->timestamps();
            $table->index(['vehicle_id', 'starts_on', 'ends_on']);
        });

        // Hub pick-ups keep a copy of the hub's coordinates so distance can be worked out on the vehicles table alone.
        DB::statement("UPDATE vehicles SET lat = (SELECT lat FROM hubs WHERE hubs.id = vehicles.hub_id), lng = (SELECT lng FROM hubs WHERE hubs.id = vehicles.hub_id), city = (SELECT city FROM hubs WHERE hubs.id = vehicles.hub_id) WHERE pickup_type = 'hub' AND hub_id IS NOT NULL");
        DB::statement("UPDATE vehicles SET area = city WHERE area IS NULL AND pickup_type = 'own'");
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_blocked_dates');
        Schema::table('bookings', fn (Blueprint $table) => $table->dropIndex('bookings_vehicle_window_index'));
        Schema::table('vehicles', function (Blueprint $table) {
            foreach (['status_rate', 'status_transmission', 'status_fuel', 'status_seats', 'status_city', 'lat_lng'] as $i) $table->dropIndex("vehicles_{$i}_index");
            $table->dropColumn('area');
        });
    }
};
