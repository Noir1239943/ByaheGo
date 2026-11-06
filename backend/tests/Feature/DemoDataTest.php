<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\Hash;
use InvalidArgumentException;
use Tests\TestCase;

/** The repository is public, so a live site must never get demo accounts with a published password. */
class DemoDataTest extends TestCase
{
    protected function live(array $config = []): void
    {
        $this->app->detectEnvironment(fn () => 'production');
        config($config + ['app.seed_demo_data' => false, 'app.demo_password' => null, 'app.admin_email' => null, 'app.admin_password' => null]);
    }

    public function test_a_live_site_gets_no_demo_accounts_by_default(): void
    {
        $this->live();
        app(DatabaseSeeder::class)->run();
        $this->assertSame(0, User::count());
        $this->assertSame(0, Booking::count());
    }

    public function test_a_live_site_can_get_one_real_admin_from_its_environment(): void
    {
        $this->live(['app.admin_email' => 'Owner@Example.com', 'app.admin_password' => 'a-long-private-secret']);
        app(DatabaseSeeder::class)->run();
        app(DatabaseSeeder::class)->run(); // running again changes nothing
        $this->assertSame(1, User::count());
        $admin = User::first();
        $this->assertSame('owner@example.com', $admin->email);
        $this->assertSame('admin', $admin->role);
        $this->assertTrue($admin->is_super_admin);
        $this->assertSame('ByaheGo Admin', $admin->name);
        $this->assertTrue(Hash::check('a-long-private-secret', $admin->password));

        $this->live(['app.admin_email' => 'second@example.com', 'app.admin_password' => 'short']);
        $this->expectException(InvalidArgumentException::class);
        app(DatabaseSeeder::class)->run();
    }

    public function test_demo_data_on_a_live_site_needs_a_strong_password_from_the_environment(): void
    {
        $this->live(['app.seed_demo_data' => true]);
        try {
            app(DatabaseSeeder::class)->run();
            $this->fail('Seeding without DEMO_PASSWORD must refuse.');
        } catch (InvalidArgumentException $e) {
            $this->assertStringContainsString('DEMO_PASSWORD', $e->getMessage());
        }
        config(['app.demo_password' => 'Password123']); // 11 characters
        $this->expectException(InvalidArgumentException::class);
        app(DatabaseSeeder::class)->run();
    }

    public function test_opt_in_demo_data_uses_the_environment_password_and_never_resets_anything(): void
    {
        $this->live(['app.seed_demo_data' => true, 'app.demo_password' => 'correct-horse-battery']);
        app(DatabaseSeeder::class)->run();

        $admin = User::where('username', 'Admin')->first();
        $this->assertSame('ByaheGo Admin', $admin->name);
        $this->assertTrue(Hash::check('correct-horse-battery', $admin->password));
        $this->assertFalse(Hash::check('Password123', $admin->password), 'The old published password must not work.');
        $this->postJson('/api/auth/login', ['login' => 'Test123', 'password' => 'correct-horse-battery'])->assertOk();
        $this->postJson('/api/auth/login', ['login' => 'Test123', 'password' => 'Password123'])->assertStatus(422);

        // A redeploy runs the seeder again: real changes made since then survive.
        $users = User::count();
        $bookings = Booking::count();
        $admin->update(['name' => 'Someone Else']);
        $admin->forceFill(['password' => 'changed-after-deploy-1'])->save();
        app(DatabaseSeeder::class)->run();
        $this->assertSame($users, User::count());
        $this->assertSame($bookings, Booking::count());
        $this->assertSame('Someone Else', $admin->fresh()->name);
        $this->assertTrue(Hash::check('changed-after-deploy-1', $admin->fresh()->password));
    }

    public function test_local_demo_accounts_get_a_made_up_password_not_a_published_one(): void
    {
        config(['app.demo_password' => null]);
        app(DatabaseSeeder::class)->run();
        $this->assertFalse(Hash::check('Password123', User::where('username', 'Test123')->value('password')));
    }

    public function test_the_set_password_command_fixes_an_already_seeded_database(): void
    {
        $this->makeUser(['username' => 'Admin', 'email' => 'admin@byahego.test', 'name' => 'Real Person', 'role' => 'admin']);
        $real = $this->makeUser(['email' => 'real@example.com']);
        $this->artisan('demo:set-password')->assertFailed();

        config(['app.demo_password' => 'too-short']);
        $this->expectException(InvalidArgumentException::class);
        $this->artisan('demo:set-password');
    }

    public function test_the_set_password_command_changes_only_demo_accounts(): void
    {
        $this->makeUser(['username' => 'Admin', 'email' => 'admin@byahego.test', 'name' => 'Real Person', 'role' => 'admin']);
        $real = $this->makeUser(['email' => 'real@example.com']);
        $before = $real->password;
        config(['app.demo_password' => 'a-strong-demo-password']);
        $this->artisan('demo:set-password')->assertSuccessful();
        $this->assertTrue(Hash::check('a-strong-demo-password', User::where('username', 'Admin')->value('password')));
        $this->assertSame('ByaheGo Admin', User::where('username', 'Admin')->value('name'));
        $this->assertSame($before, $real->fresh()->password);
    }
}
