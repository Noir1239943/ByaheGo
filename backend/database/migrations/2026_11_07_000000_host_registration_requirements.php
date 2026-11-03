<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Encrypted values are longer than the plain account number, so the columns become text.
        Schema::table('host_applications', function (Blueprint $table) {
            $table->text('payout_account_number')->change();
            $table->string('payout_bank', 60)->nullable();
            $table->timestamp('terms_accepted_at')->nullable();
            $table->string('terms_version', 10)->nullable();
        });
        Schema::table('users', function (Blueprint $table) {
            $table->text('payout_account_number')->nullable()->change();
            $table->string('payout_bank', 60)->nullable();
        });

        // Encrypt the account numbers that are already stored in plain text.
        foreach (['host_applications', 'users'] as $t) {
            DB::table($t)->whereNotNull('payout_account_number')->orderBy('id')->each(function ($row) use ($t) {
                if ($this->isEncrypted($row->payout_account_number)) return;
                DB::table($t)->where('id', $row->id)->update(['payout_account_number' => Crypt::encryptString($row->payout_account_number)]);
            });
        }

        Schema::table('vehicles', function (Blueprint $table) {
            $table->foreignId('ctpl_media_id')->nullable()->constrained('media')->nullOnDelete(); // CTPL insurance certificate
            $table->date('ctpl_expiry')->nullable();
            $table->unsignedSmallInteger('grace_minutes')->default(30); // free minutes after the return time
            $table->string('fuel_policy', 20)->default('same_level'); // same_level | full_to_full
        });
    }

    public function down(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->dropConstrainedForeignId('ctpl_media_id');
            $table->dropColumn(['ctpl_expiry', 'grace_minutes', 'fuel_policy']);
        });
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('payout_bank'));
        Schema::table('host_applications', fn (Blueprint $table) => $table->dropColumn(['payout_bank', 'terms_accepted_at', 'terms_version']));
    }

    protected function isEncrypted(string $value): bool
    {
        try {
            Crypt::decryptString($value);
            return true;
        } catch (Throwable) {
            return false;
        }
    }
};
