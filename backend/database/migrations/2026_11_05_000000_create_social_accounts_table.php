<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('social_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('provider', 20); // google | facebook
            $table->string('provider_user_id');
            $table->timestamps();
            $table->unique(['provider', 'provider_user_id']);
            $table->index('user_id');
        });

        // Accounts that already signed in with Google keep working.
        foreach (DB::table('users')->whereNotNull('google_id')->get(['id', 'google_id']) as $u) {
            DB::table('social_accounts')->insert(['user_id' => $u->id, 'provider' => 'google', 'provider_user_id' => $u->google_id, 'created_at' => now(), 'updated_at' => now()]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('social_accounts');
    }
};
