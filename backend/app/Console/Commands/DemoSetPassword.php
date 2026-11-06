<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Support\DemoData;
use Illuminate\Console\Command;

/** Puts DEMO_PASSWORD on every demo account (the ones with an @byahego.test address) and signs them out. Nothing else changes. */
class DemoSetPassword extends Command
{
    protected $signature = 'demo:set-password';
    protected $description = 'Set the DEMO_PASSWORD on all demo accounts of an already seeded database';

    public function handle(): int
    {
        $password = (string) config('app.demo_password');
        if ($password === '') {
            $this->error('Set DEMO_PASSWORD (at least '.DemoData::MIN_PASSWORD_LENGTH.' characters) first.');
            return self::FAILURE;
        }
        DemoData::assertStrong($password, 'DEMO_PASSWORD');

        $n = 0;
        User::where('email', 'like', '%@byahego.test')->get()->each(function (User $u) use ($password, &$n) {
            $u->forceFill(['password' => $password])->save();
            $u->tokens()->delete();
            $n++;
        });
        User::where('username', 'Admin')->where('email', 'admin@byahego.test')->update(['name' => 'ByaheGo Admin']);
        $this->info("Password updated on {$n} demo accounts.");
        return self::SUCCESS;
    }
}
