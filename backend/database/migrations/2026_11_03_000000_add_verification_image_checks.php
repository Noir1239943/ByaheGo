<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('media', function (Blueprint $table) {
            $table->string('phash', 16)->nullable()->index(); // 64-bit difference hash (hex) of ID photos, for near-duplicate detection
        });

        Schema::table('driver_licenses', function (Blueprint $table) {
            $table->json('client_checks')->nullable(); // results reported by the renter's browser (supporting evidence only, not proof)
            $table->string('auto_label', 20)->nullable(); // reject | check | good | incomplete
        });
    }

    public function down(): void
    {
        Schema::table('driver_licenses', fn (Blueprint $table) => $table->dropColumn(['client_checks', 'auto_label']));
        Schema::table('media', function (Blueprint $table) {
            $table->dropIndex(['phash']);
            $table->dropColumn('phash');
        });
    }
};
