<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_super_admin')->default(false); // can override automatic ID decisions
        });
        // Existing deployments: the first admin account becomes the super admin.
        $first = DB::table('users')->where('role', 'admin')->orderBy('id')->value('id');
        if ($first) DB::table('users')->where('id', $first)->update(['is_super_admin' => true]);

        Schema::table('driver_licenses', function (Blueprint $table) {
            $table->string('auto_decision', 10)->nullable()->index(); // approve | reject | review: what the rules decided
            $table->string('decision_source', 10)->nullable(); // auto | admin: who made the decision that stands
            $table->text('auto_decision_reason')->nullable(); // full reason for admins
            $table->timestamp('auto_decided_at')->nullable();
            $table->foreignId('overridden_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('overridden_at')->nullable();
            $table->string('override_note')->nullable();
        });

        // Audit trail: one row per automatic decision (including "needs review") and per override.
        Schema::create('verification_decisions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('driver_license_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('event', 20); // auto_decision | override
            $table->string('outcome', 10); // approve | reject | review
            $table->text('reason');
            $table->json('triggers')->nullable(); // check keys that caused the outcome
            $table->json('checks')->nullable(); // snapshot of every check: key, result, source, value
            $table->json('scores')->nullable(); // score, label, face match, liveness, antispoof
            $table->json('settings')->nullable(); // thresholds, margins and the auto-approve switch at that moment
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete(); // set for overrides
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('verification_decisions');
        Schema::table('driver_licenses', function (Blueprint $table) {
            $table->dropConstrainedForeignId('overridden_by');
            $table->dropColumn(['auto_decision', 'decision_source', 'auto_decision_reason', 'auto_decided_at', 'overridden_at', 'override_note']);
        });
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('is_super_admin'));
    }
};
