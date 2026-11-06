<?php

namespace Database\Seeders;

use App\Models\AdminAuditLog;
use App\Models\Booking;
use App\Models\DriverLicense;
use App\Models\Favorite;
use App\Models\HostApplication;
use App\Models\Hub;
use App\Models\Incident;
use App\Models\Media;
use App\Models\Payment;
use App\Models\Payout;
use App\Models\RecentlyViewed;
use App\Models\Review;
use App\Models\SocialAccount;
use App\Models\SupportTicket;
use App\Models\VerificationDecision;
use App\Models\User;
use App\Models\UserNotification;
use App\Models\Vehicle;
use App\Services\PricingService;
use App\Services\VerificationChecker;
use App\Services\VerificationDecider;
use App\Support\DemoData;
use App\Support\Settings;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Populates a fresh database with demo data (accounts, Cebu vehicles, trips, payments).
 * Safe to run on every deploy: it never touches existing data and does nothing if the demo admin already exists.
 * On a live site (APP_ENV=production) demo data is only created when SEED_DEMO_DATA=true, with the password from DEMO_PASSWORD.
 */
class DatabaseSeeder extends Seeder
{
    /** Demo trips are scheduled in Cebu local time, then stored in UTC. */
    protected const TZ = 'Asia/Manila';

    protected int $receipt = 100100;
    protected array $hubs = [];
    protected array $users = [];

    /** The password of every demo account for this run. */
    protected string $password = '';

    public function run(): void
    {
        if (! DemoData::allowed()) {
            $this->seedAdminOnly();
            return;
        }
        if (User::where('username', 'Admin')->exists()) {
            $this->command?->info('Database already has demo data – skipping seed.');
            return;
        }
        [$this->password, $generated] = DemoData::password();
        Model::unguard();
        mt_srand(2026);
        DB::transaction(function () {
            $this->seedUsers();
            $this->seedHubs();
            $vehicles = $this->seedVehicles();
            $this->seedLicenses();
            $this->seedBookings($vehicles);
            $this->seedExtras($vehicles);
            $this->seedAccountsAndAudit();
            $this->seedAgreements();
        });
        Model::reguard();
        Settings::flush();
        if ($generated) {
            $this->command?->warn("Demo accounts were created. Their password is: {$this->password}  (set DEMO_PASSWORD in .env to choose your own)");
        }
    }

    /** A live site without demo data: creates one real admin from ADMIN_EMAIL and ADMIN_PASSWORD, if both are set and nobody has that email. */
    protected function seedAdminOnly(): void
    {
        $email = strtolower(trim((string) config('app.admin_email')));
        $password = (string) config('app.admin_password');
        if ($email === '' || $password === '') {
            $this->command?->info('Demo data is off (SEED_DEMO_DATA is not true). No accounts were created.');
            return;
        }
        DemoData::assertStrong($password, 'ADMIN_PASSWORD');
        if (User::where('email', $email)->exists()) {
            $this->command?->info('The administrator already exists.');
            return;
        }
        (new User)->forceFill(['name' => 'ByaheGo Admin', 'username' => 'siteadmin', 'email' => $email, 'password' => $password, 'role' => 'admin',
            'is_super_admin' => true, 'verification_status' => 'verified', 'email_verified_at' => now()])->save();
        $this->command?->info("Administrator {$email} created.");
    }

    protected function user(string $username, string $name, string $role = 'renter', array $extra = []): User
    {
        $email = $extra['email'] ?? strtolower(str_replace([' ', '.'], ['.', ''], $name)).'@byahego.test';
        unset($extra['email']);
        return $this->users[$username] = User::create(array_merge([
            'name' => $name,
            'username' => $username,
            'email' => $email,
            'password' => $this->password,
            'role' => $role,
            'verification_status' => 'verified',
            'email_verified_at' => now(),
            'created_at' => now()->subMonths(mt_rand(6, 20))->subDays(mt_rand(0, 28)),
        ], $extra));
    }

    protected function seedUsers(): void
    {
        $this->user('Admin', 'ByaheGo Admin', 'admin', ['email' => 'admin@byahego.test', 'phone' => '0917 000 0001', 'city' => 'Cordova', 'is_super_admin' => true]);
        $this->user('Test123', 'Vincent Laroco', 'renter', ['email' => 'test123@byahego.test', 'phone' => '0917 123 4567', 'city' => 'Lapu-Lapu City']);

        $payout = fn ($method, $name, $no) => ['payout_method' => $method, 'payout_account_name' => $name, 'payout_account_number' => $no];
        $this->user('Host123', 'Carlo Mendoza', 'host', ['phone' => '0918 220 4471', 'city' => 'Cebu City'] + $payout('gcash', 'Carlo Mendoza', '09182204471'));
        $this->user('miguel.reyes', 'Miguel Reyes', 'host', ['phone' => '0918 220 1190', 'city' => 'Mandaue City'] + $payout('bank', 'Miguel Reyes', '001234567890'));
        $this->user('joanna.lim', 'Joanna Lim', 'host', ['phone' => '0927 515 8820', 'city' => 'Mandaue City'] + $payout('maya', 'Joanna Lim', '09275158820'));
        $this->user('rafael.garcia', 'Rafael Garcia', 'host', ['phone' => '0933 410 2210', 'city' => 'Talisay City'] + $payout('gcash', 'Rafael Garcia', '09334102210'));

        foreach ([
            ['andrea.santos', 'Andrea Santos', 'Cebu City'], ['paolo.cruz', 'Paolo Cruz', 'Mandaue City'], ['bea.villanueva', 'Bea Villanueva', 'Cebu City'],
            ['nicole.tan', 'Nicole Tan', 'Talisay City'], ['mark.villareal', 'Mark Villareal', 'Lapu-Lapu City'], ['clint.goden', 'Clint Joseph Goden', 'Cordova'],
            ['billy.ceriaca', 'Billy Ceriaca', 'Cebu City'], ['carlo.dizon', 'Carlo Dizon', 'Consolacion'], ['trisha.yap', 'Trisha Yap', 'Cebu City'],
        ] as [$u, $n, $c]) {
            $this->user($u, $n, 'renter', ['city' => $c, 'phone' => '09'.mt_rand(10, 99).' '.mt_rand(100, 999).' '.mt_rand(1000, 9999)]);
        }
        $this->user('jerome.bautista', 'Jerome Bautista', 'renter', ['verification_status' => 'pending', 'city' => 'Cebu City', 'created_at' => now()->subDays(3)]);
        $this->user('rica.domingo', 'Rica Domingo', 'renter', ['verification_status' => 'pending', 'city' => 'Mandaue City', 'created_at' => now()->subDays(2)]);
        $this->user('lance.uy', 'Lance Uytengsu', 'renter', ['verification_status' => 'pending', 'city' => 'Lapu-Lapu City', 'created_at' => now()->subDay()]);
        // Renters whose ID check is decided automatically (see seedAutoDecisions).
        $this->user('dennis.cruz', 'Dennis Cruz', 'renter', ['verification_status' => 'unverified', 'city' => 'Cebu City', 'phone' => '0917 662 3081', 'created_at' => now()->subDays(4)]);
        $this->user('ana.lopez', 'Ana Lopez', 'renter', ['verification_status' => 'unverified', 'city' => 'Mandaue City', 'phone' => '0928 407 1176', 'created_at' => now()->subDays(3)]);
        // A temporary suspension that ends by itself, and a permanent revoke.
        $this->user('sofia.ramos', 'Sofia Ramos', 'renter', ['status' => 'suspended', 'suspended_at' => now()->subDays(2), 'suspended_until' => now()->addDays(12), 'suspended_reason' => 'Name on the ID did not match the account. Please contact support to confirm your identity.', 'blocked_by' => $this->users['Admin']->id, 'city' => 'Talisay City']);
        $this->user('marco.tan', 'Marco Tan', 'renter', ['status' => 'revoked', 'suspended_at' => now()->subDays(6), 'revoked_at' => now()->subDays(6), 'suspended_reason' => 'Repeated fraudulent bookings', 'blocked_by' => $this->users['Admin']->id, 'city' => 'Cebu City']);
        $this->user('kim.navarro', 'Kim Navarro', 'renter', ['verification_status' => 'unverified', 'city' => 'Cordova', 'phone' => '0945 118 2290', 'created_at' => now()->subDays(9)]);
        $this->user('diego.ramos', 'Diego Ramos', 'renter', ['status' => 'suspended', 'suspended_at' => now()->subDays(20), 'suspended_reason' => 'Vehicle not returned (BG case under investigation)', 'city' => 'Cebu City']);
    }

    protected function seedHubs(): void
    {
        foreach ([
            ['Ayala Center Cebu Hub', 'Cebu Business Park, Archbishop Reyes Ave', 'Cebu City', 10.3181, 123.9054, 'Basement 2 parking, Bay B12–B20'],
            ['SM City Cebu Hub', 'North Reclamation Area', 'Cebu City', 10.3116, 123.9182, 'Open parking, North Wing near Gate 3'],
            ['IT Park Hub', 'Cebu IT Park, Apas', 'Cebu City', 10.3307, 123.9061, 'The Walk basement parking'],
            ['Mandani Bay Hub', 'Hernan Cortes St, Subangdaku', 'Mandaue City', 10.3253, 123.9332, 'Covered parking with CCTV and staff on site'],
            ['Il Corso Hub', 'South Road Properties', 'Cebu City', 10.2827, 123.8794, 'Il Corso open parking, Lot C'],
            ['Mactan Airport Hub', 'Mactan-Cebu International Airport, Terminal 1', 'Lapu-Lapu City', 10.3105, 123.9802, 'Arrivals curbside, Bay 7 – we meet you at the exit'],
            ['Cordova Hub', 'Poblacion, near Cordova Municipal Hall', 'Cordova', 10.2526, 123.9493, 'Covered parking beside the public market'],
        ] as [$name, $address, $city, $lat, $lng, $notes]) {
            $this->hubs[$name] = Hub::create(compact('name', 'address', 'city', 'lat', 'lng') + ['parking_notes' => $notes]);
        }
    }

    protected function seedVehicles(): array
    {
        $carFeatures = ['Air conditioning', 'Bluetooth audio', 'USB charging', 'Backup camera', 'Dash cam', 'Apple CarPlay', 'Android Auto', 'Child seat anchors', 'Keyless entry', 'Cruise control', 'Roof rack', 'Spare tire & tools'];
        $hub = fn ($name) => ['pickup_type' => 'hub', 'hub_id' => $this->hubs[$name]->id, 'city' => $this->hubs[$name]->city, 'lat' => $this->hubs[$name]->lat, 'lng' => $this->hubs[$name]->lng];
        // The public area is the barangay part of the address (the part that is not a landmark), never the street.
        $own = fn ($address, $city, $lat, $lng) => ['pickup_type' => 'own', 'pickup_address' => $address, 'city' => $city, 'area' => (collect(explode(',', $address))->map(fn ($p) => trim($p))->reject(fn ($p) => str_starts_with($p, 'near '))->last()) ?: $city, 'lat' => $lat, 'lng' => $lng];

        $list = [
            ['Host123', 'Toyota', 'Fortuner', 2023, 'suv', 'automatic', 'diesel', 7, 'Pearl White', '#E9EDF0', 3200, $hub('Ayala Center Cebu Hub'), ['driver' => 1500, 'deposit' => 5000, 'plate' => 'NBC 4821', 'weekly' => 19800],
                'A roomy, well-kept 7-seater that handles city traffic and long drives to Oslob or Moalboal with ease. Comes with a full tank, child-seat anchors and a freshly cleaned cabin. Great for family trips and barkada getaways.'],
            ['Host123', 'Toyota', 'Vios', 2022, 'sedan', 'automatic', 'gasoline', 5, 'Red Mica', '#D7263D', 1800, $hub('IT Park Hub'), ['plate' => 'GAB 2210', 'weekly' => 11200],
                'Fuel-efficient and easy to park – perfect for errands, airport runs and getting around the city.'],
            ['miguel.reyes', 'Mitsubishi', 'Montero Sport', 2022, 'suv', 'automatic', 'diesel', 7, 'Sterling Silver', '#A7B1BA', 3400, $own('Tabunok, near Gaisano Fiesta Mall', 'Talisay City', 10.2627, 123.8424), ['deposit' => 5000, 'plate' => 'NDF 7781', 'delivery' => 500],
                'Powerful diesel SUV with 4x2 drive, perfect for mountain roads to Busay and Sirao. Cold aircon and leather seats.'],
            ['joanna.lim', 'Honda', 'City', 2023, 'sedan', 'automatic', 'gasoline', 5, 'Ignite Red', '#B3202A', 2000, $own('A.S. Fortuna St, Banilad', 'Mandaue City', 10.3363, 123.9180), ['plate' => 'NGH 1123', 'delivery' => 300],
                'Comfortable sedan with a smooth CVT, Apple CarPlay and plenty of trunk space for luggage.'],
            ['rafael.garcia', 'Ford', 'Everest', 2022, 'suv', 'automatic', 'diesel', 7, 'Absolute Black', '#1F2933', 3600, $hub('SM City Cebu Hub'), ['driver' => 1600, 'deposit' => 5000, 'plate' => 'NEV 5520'],
                'Premium 7-seater with adaptive cruise control and a panoramic sunroof. Driver available on request.'],
            ['miguel.reyes', 'Nissan', 'Almera', 2023, 'sedan', 'automatic', 'gasoline', 5, 'Horizon Blue', '#8FB8DE', 1700, $hub('Mandani Bay Hub'), ['plate' => 'NAL 3019'],
                'Newest-generation Almera with a punchy turbo engine and great fuel economy.'],
            ['Host123', 'Toyota', 'Rush', 2022, 'suv', 'automatic', 'gasoline', 7, 'Dark Red Mica', '#5B1A3A', 2400, $hub('Cordova Hub'), ['plate' => 'NRS 6612', 'pet' => true],
                'Compact 7-seater SUV – easy to drive around Mactan and roomy enough for the whole family. Pet-friendly!'],
            ['joanna.lim', 'Hyundai', 'Accent', 2021, 'sedan', 'automatic', 'gasoline', 5, 'Fiery Red', '#C0392B', 1650, $own('Pusok, near Gaisano Mactan', 'Lapu-Lapu City', 10.3197, 123.9729), ['plate' => 'GAH 4410', 'delivery' => 250],
                'Reliable and economical. Pick it up near the airport and head straight to your resort.'],
            ['rafael.garcia', 'Isuzu', 'mu-X', 2023, 'suv', 'automatic', 'diesel', 7, 'Mercury Silver', '#8A939B', 3300, $hub('Il Corso Hub'), ['deposit' => 5000, 'plate' => 'NMX 8823'],
                'Spacious diesel SUV with excellent fuel economy for long drives down south.'],
            ['miguel.reyes', 'Toyota', 'Hiace Grandia', 2022, 'van', 'manual', 'diesel', 12, 'Graphite', '#2B2F33', 4500, $hub('Mactan Airport Hub'), ['driver' => 1800, 'deposit' => 6000, 'plate' => 'NHG 9001', 'weekly' => 28000],
                'Ideal for big groups, church trips and company outings. Professional driver available – just relax and enjoy the ride.'],
            ['Host123', 'Toyota', 'Avanza', 2023, 'mpv', 'automatic', 'gasoline', 7, 'Lagoon Teal', '#0D7C6B', 2300, $hub('Cordova Hub'), ['plate' => 'NAV 2290'],
                'Budget-friendly 7-seater MPV with rear aircon vents – a favorite for family trips around Cebu.'],
            ['joanna.lim', 'Mitsubishi', 'Xpander', 2023, 'mpv', 'automatic', 'gasoline', 7, 'Quartz White', '#F1F3F5', 2500, $hub('IT Park Hub'), ['plate' => 'NXP 1180'],
                'Modern MPV with flexible seating and a smooth ride. Plenty of space for luggage when you fold the third row.'],
            ['rafael.garcia', 'Suzuki', 'Ertiga', 2022, 'mpv', 'manual', 'gasoline', 7, 'Midnight Blue', '#2E5A88', 2000, $own('Poblacion Oriental, near SM Consolacion', 'Consolacion', 10.3766, 123.9573), ['plate' => 'NER 3321'],
                'Light, efficient 7-seater that is easy to drive in city traffic.'],
            ['miguel.reyes', 'Toyota', 'Wigo', 2022, 'hatchback', 'manual', 'gasoline', 5, 'Mango Yellow', '#FFB224', 1300, $own('Basak, near Gaisano Basak', 'Lapu-Lapu City', 10.2911, 123.9640), ['plate' => 'GAW 1001'],
                'The most affordable way to get around – tiny on gas and easy to park anywhere.'],
            ['joanna.lim', 'Honda', 'Brio', 2023, 'hatchback', 'automatic', 'gasoline', 5, 'Phoenix Orange', '#F28C28', 1400, $own('Banilad Town Centre', 'Cebu City', 10.3413, 123.9133), ['plate' => 'GBR 7701'],
                'Zippy automatic hatchback, perfect for solo travelers and couples.'],
            ['Host123', 'Toyota', 'Innova', 2021, 'mpv', 'manual', 'diesel', 8, 'Silver Metallic', '#B7BEC5', 2600, $hub('Ayala Center Cebu Hub'), ['driver' => 1500, 'plate' => 'NIN 4402'],
                'Tough and comfortable 8-seater diesel. A local favorite for out-of-town trips.'],
            ['rafael.garcia', 'Nissan', 'Navara', 2022, 'pickup', 'automatic', 'diesel', 5, 'White Pearl', '#E9ECEF', 3000, $own('Lawaan III, near Talisay City Hall', 'Talisay City', 10.2447, 123.8494), ['deposit' => 5000, 'plate' => 'NNV 6630'],
                'Rugged pickup for moving day, surf trips or hauling gear. Bed liner included.'],
            ['miguel.reyes', 'Toyota', 'Hilux', 2023, 'pickup', 'manual', 'diesel', 5, 'Gray Metallic', '#7D868E', 3100, $own('Centro, near Mandaue City Hall', 'Mandaue City', 10.3236, 123.9223), ['deposit' => 5000, 'plate' => 'NHX 9912'],
                'Workhorse pickup with a strong diesel engine and a 1-ton payload.'],
            ['Host123', 'Ford', 'Ranger', 2022, 'pickup', 'automatic', 'diesel', 5, 'Saber Orange', '#D35400', 3200, $hub('SM City Cebu Hub'), ['deposit' => 5000, 'plate' => 'NRG 5544'],
                'Comfortable pickup with a modern cabin, Apple CarPlay and a lockable tonneau cover.'],
            ['rafael.garcia', 'Nissan', 'Urvan', 2022, 'van', 'manual', 'diesel', 15, 'Brilliant White', '#F4F6F8', 4800, $hub('Mactan Airport Hub'), ['driver' => 1800, 'deposit' => 6000, 'plate' => 'NUV 2201'],
                '15-seater van for large groups. Airport pick-ups available with a professional driver.'],
            ['joanna.lim', 'Yamaha', 'NMAX', 2024, 'motorcycle', 'automatic', 'gasoline', 2, 'Matte Black', '#22272B', 650, $hub('Cordova Hub'), ['deposit' => 1500, 'plate' => '123 ABC', 'late' => 100],
                'Comfortable 155cc scooter with ABS. Two helmets included.'],
            ['miguel.reyes', 'Honda', 'Click 125', 2023, 'motorcycle', 'automatic', 'gasoline', 2, 'Candy Red', '#C0392B', 550, $own('Marigondon, near Mactan Newtown', 'Lapu-Lapu City', 10.2883, 124.0052), ['deposit' => 1500, 'plate' => '456 DEF', 'late' => 80],
                'Light and fuel-efficient – the easiest way to explore Mactan island. Helmet included.'],
            ['rafael.garcia', 'Honda', 'ADV 160', 2024, 'motorcycle', 'automatic', 'gasoline', 2, 'Shasta Gray', '#6C7A89', 800, $hub('IT Park Hub'), ['deposit' => 2000, 'plate' => '789 GHI', 'late' => 120],
                'Adventure scooter with long-travel suspension – great for trips up to Tops Lookout.'],
            ['joanna.lim', 'Kia', 'Stonic', 2023, 'suv', 'automatic', 'gasoline', 5, 'Jungle Green', '#2E7D5B', 2200, $hub('Il Corso Hub'), ['plate' => 'NST 4420'],
                'Stylish compact crossover with great visibility and a smooth automatic.'],
            ['Host123', 'Hyundai', 'Stargazer', 2023, 'mpv', 'automatic', 'gasoline', 7, 'Deep Blue', '#3D5A80', 2400, $hub('Mandani Bay Hub'), ['plate' => 'NSG 7713'],
                'Futuristic 7-seater MPV with captain seats and lots of USB ports for everyone.'],
        ];

        $out = [];
        foreach ($list as $i => [$host, $make, $model, $year, $type, $trans, $fuel, $seats, $color, $hex, $rate, $loc, $opt, $desc]) {
            $isMoto = $type === 'motorcycle';
            $features = $isMoto ? ['Helmet included', 'ABS', 'USB charging', 'Phone holder'] : collect($carFeatures)->shuffle()->take(mt_rand(5, 8))->sort()->values()->all();
            if (! $isMoto && ! in_array('Air conditioning', $features, true)) array_unshift($features, 'Air conditioning');
            $approved = now()->subMonths(mt_rand(6, 14));
            $out[] = Vehicle::create(array_merge([
                'host_id' => $this->users[$host]->id,
                'make' => $make, 'model' => $model, 'year' => $year, 'type' => $type, 'transmission' => $trans, 'fuel' => $fuel,
                'seats' => $seats, 'color' => $color, 'color_hex' => $hex, 'plate_number' => $opt['plate'],
                'description' => $desc, 'features' => $features, 'daily_rate' => $rate, 'weekly_rate' => $opt['weekly'] ?? null,
                'with_driver_available' => isset($opt['driver']), 'driver_fee_per_day' => $opt['driver'] ?? 0,
                'instant_book' => true, 'delivery_available' => isset($opt['delivery']), 'delivery_fee' => $opt['delivery'] ?? 0,
                'pet_friendly' => $opt['pet'] ?? false, 'security_deposit' => $opt['deposit'] ?? 3000,
                'late_fee_per_hour' => $opt['late'] ?? (int) (round($rate * 0.1 / 10) * 10),
                'status' => 'live', 'submitted_at' => $approved->copy()->subDays(2), 'approved_at' => $approved,
                'created_at' => $approved->copy()->subDays(3),
            ], $loc));
        }

        // Listings waiting for admin review, and one paused by its host.
        $or = $this->media('vehicle_or.png', 'vehicle_or', $this->users['rafael.garcia']);
        $cr = $this->media('vehicle_cr.png', 'vehicle_cr', $this->users['rafael.garcia']);
        Vehicle::create(array_merge([
            'host_id' => $this->users['rafael.garcia']->id, 'make' => 'Geely', 'model' => 'Coolray', 'year' => 2023, 'type' => 'suv', 'transmission' => 'automatic',
            'fuel' => 'gasoline', 'seats' => 5, 'color' => 'Ruby Red', 'color_hex' => '#A93226', 'plate_number' => 'GAA 1234', 'daily_rate' => 2700,
            'description' => 'Turbocharged compact SUV with a 360° camera and panoramic roof.', 'features' => ['Air conditioning', 'Apple CarPlay', '360° camera', 'Keyless entry'],
            'security_deposit' => 4000, 'late_fee_per_hour' => 270, 'status' => 'pending', 'submitted_at' => now()->subHours(20),
            'or_media_id' => $or->id, 'cr_media_id' => $cr->id,
        ], $hub('SM City Cebu Hub')));
        $or2 = $this->media('vehicle_or.png', 'vehicle_or', $this->users['miguel.reyes']);
        $cr2 = $this->media('vehicle_cr.png', 'vehicle_cr', $this->users['miguel.reyes']);
        Vehicle::create(array_merge([
            'host_id' => $this->users['miguel.reyes']->id, 'make' => 'Toyota', 'model' => 'Corolla Cross Hybrid', 'year' => 2024, 'type' => 'suv', 'transmission' => 'automatic',
            'fuel' => 'hybrid', 'seats' => 5, 'color' => 'Celestite Gray', 'color_hex' => '#9AA5AE', 'plate_number' => 'NCC 2024', 'daily_rate' => 3000,
            'description' => 'Quiet, efficient hybrid crossover – up to 20 km/L in the city.', 'features' => ['Air conditioning', 'Toyota Safety Sense', 'Android Auto', 'Apple CarPlay'],
            'security_deposit' => 5000, 'late_fee_per_hour' => 300, 'status' => 'pending', 'submitted_at' => now()->subHours(6),
            'or_media_id' => $or2->id, 'cr_media_id' => $cr2->id,
        ], $hub('Mandani Bay Hub')));
        Vehicle::create(array_merge([
            'host_id' => $this->users['Host123']->id, 'make' => 'Suzuki', 'model' => 'Jimny', 'year' => 2023, 'type' => 'suv', 'transmission' => 'manual',
            'fuel' => 'gasoline', 'seats' => 4, 'color' => 'Jungle Green', 'color_hex' => '#3E5F45', 'plate_number' => 'NJM 1010', 'daily_rate' => 2800,
            'description' => 'Iconic little 4x4 for off-road adventures.', 'features' => ['4x4', 'Air conditioning', 'Bluetooth audio'],
            'security_deposit' => 4000, 'late_fee_per_hour' => 280, 'status' => 'paused', 'approved_at' => now()->subMonths(4),
        ], $hub('Cordova Hub')));

        return $out;
    }

    protected function media(string $file, string $purpose, User $user): Media
    {
        $path = __DIR__.'/assets/'.$file;
        $contents = file_get_contents($path);
        [$w, $h] = getimagesizefromstring($contents);
        return Media::create([
            'user_id' => $user->id, 'purpose' => $purpose, 'visibility' => 'private', 'mime' => 'image/png',
            'size' => strlen($contents), 'width' => $w, 'height' => $h, 'sha1' => sha1($contents.$user->id),
            // Demo art is reused between accounts, so give each fixture its own hash instead of letting them flag each other.
            'phash' => substr(sha1('phash'.$contents.$user->id), 0, 16), 'data' => base64_encode($contents),
        ]);
    }

    protected function seedLicenses(): void
    {
        $admin = $this->users['Admin'];
        foreach ($this->users as $username => $u) {
            if ($u->verification_status !== 'verified' || $u->role === 'admin') continue;
            $number = $username === 'Test123' ? 'N01-23-456789' : chr(65 + mt_rand(0, 25)).sprintf('%02d-%02d-%06d', mt_rand(1, 16), mt_rand(15, 24), mt_rand(100000, 999999));
            DriverLicense::create([
                'user_id' => $u->id, 'license_type' => 'ph', 'license_number' => $number, 'full_name' => $u->name,
                'birthdate' => now()->subYears(mt_rand(23, 45))->subDays(mt_rand(0, 300))->toDateString(),
                'expiry_date' => now()->addYears(mt_rand(1, 5))->toDateString(), 'address' => $u->city.', Cebu',
                'nationality' => 'Filipino', 'restriction_codes' => ['A', 'B', 'B1'], 'status' => 'approved', 'auto_score' => 100,
                'auto_checks' => [], 'reviewed_by' => $admin->id, 'reviewed_at' => $u->created_at->copy()->addDay(), 'created_at' => $u->created_at->copy()->addHours(5),
            ]);
        }

        $checker = app(VerificationChecker::class);
        $pending = [
            ['jerome.bautista', 1, 'JEROME BAUTISTA', 'N04-19-552310', 27],
            ['rica.domingo', 2, 'RICA DOMINGO', 'N11-21-660184', 24],
            ['lance.uy', 3, 'LANCE UY', 'G02-20-118745', 20],
        ];
        foreach ($pending as [$username, $n, $name, $number, $age]) {
            $u = $this->users[$username];
            $license = DriverLicense::create([
                'user_id' => $u->id, 'license_type' => 'ph', 'license_number' => $number, 'full_name' => ucwords(strtolower($name)),
                'birthdate' => now()->subYears($age)->subDays(40)->toDateString(), 'expiry_date' => '2030-05-14',
                'address' => $u->city.', Cebu', 'nationality' => 'Filipino', 'restriction_codes' => ['A', 'B', 'B1'],
                'front_media_id' => $this->media("license_front_{$n}.png", 'license_front', $u)->id,
                'back_media_id' => $this->media("license_back_{$n}.png", 'license_back', $u)->id,
                'selfie_media_id' => $this->media("selfie_{$n}.png", 'selfie', $u)->id,
                'status' => 'pending', 'created_at' => now()->subHours(mt_rand(2, 30)),
            ]);
            $result = $checker->run($license, $u);
            $license->update(['auto_score' => $result['score'], 'auto_label' => $result['label'], 'auto_checks' => $result['checks']]);
        }
        $this->seedAutoDecisions($checker);
    }

    /** One submission the rules approved on their own and one they rejected, with their decision logs. */
    protected function seedAutoDecisions(VerificationChecker $checker): void
    {
        $decider = app(VerificationDecider::class);
        $original = config('verification.auto_approve');
        config(['verification.auto_approve' => true]);
        $device = function (float $faceMatch) {
            $checks = [];
            foreach (array_keys(VerificationChecker::DEVICE_CHECKS) as $key) {
                $checks[] = ['key' => $key, 'status' => 'pass', 'value' => in_array($key, ['face_match']) ? $faceMatch : 0.9, 'detail' => 'ok'];
            }
            return VerificationChecker::sanitizeClientChecks([
                'checks' => $checks, 'face_similarity' => $faceMatch, 'liveness' => 0.92, 'antispoof' => 0.94,
                'ocr_keyword_hits' => ['REPUBLIC OF THE PHILIPPINES', 'LAND TRANSPORTATION OFFICE', "DRIVER'S LICENSE"],
                'ocr_text' => ['front' => "REPUBLIC OF THE PHILIPPINES\nLAND TRANSPORTATION OFFICE\nDRIVER'S LICENSE", 'back' => 'RESTRICTIONS CONDITIONS'],
                'faces' => ['license' => ['x' => 0.06, 'y' => 0.3, 'w' => 0.24, 'h' => 0.42], 'selfie' => ['x' => 0.3, 'y' => 0.2, 'w' => 0.3, 'h' => 0.45]],
            ]);
        };
        foreach ([
            ['dennis.cruz', 'Dennis Cruz', 'N07-22-348821', 4, 0.86, 'Brgy. Lahug, Cebu City'],
            ['ana.lopez', 'Ana Lopez', 'N09-21-771204', 5, 0.31, 'A.S. Fortuna St, Banilad, Mandaue City'],
        ] as [$username, $name, $number, $n, $match, $address]) {
            $u = $this->users[$username];
            $license = DriverLicense::create([
                'user_id' => $u->id, 'license_type' => 'ph', 'license_number' => $number, 'full_name' => $name,
                'birthdate' => now()->subYears(31)->subDays(40)->toDateString(), 'expiry_date' => now()->addYears(4)->toDateString(),
                'address' => $address, 'nationality' => 'Filipino', 'restriction_codes' => ['A', 'B', 'B1'],
                'front_media_id' => $this->media('license_front_'.(($n % 3) + 1).'.png', 'license_front', $u)->id,
                'back_media_id' => $this->media('license_back_'.(($n % 3) + 1).'.png', 'license_back', $u)->id,
                'selfie_media_id' => $this->media('selfie_'.(($n % 3) + 1).'.png', 'selfie', $u)->id,
                'client_checks' => $device($match), 'status' => 'pending', 'created_at' => now()->subHours(mt_rand(30, 70)),
            ]);
            $result = $checker->run($license, $u);
            $license->update(['auto_score' => $result['score'], 'auto_label' => $result['label'], 'auto_checks' => $result['checks']]);
            $decider->apply($license->fresh(), $u, $result);
        }
        config(['verification.auto_approve' => $original]);
    }

    /** Sign-in links, blocked accounts and a trail of admin actions for the audit log screen. */
    /** Every demo booking gets a signed agreement, so the PDF downloads work on demo data too. */
    public function seedAgreements(): void
    {
        $agreements = app(\App\Services\AgreementService::class);
        Booking::with('agreement')->each(fn (Booking $b) => $agreements->backfill($b));
    }

    protected function seedAccountsAndAudit(): void
    {
        SocialAccount::create(['user_id' => $this->users['andrea.santos']->id, 'provider' => 'google', 'provider_user_id' => '110248113551']);
        SocialAccount::create(['user_id' => $this->users['paolo.cruz']->id, 'provider' => 'facebook', 'provider_user_id' => '10159123450']);

        $admin = $this->users['Admin'];
        $log = fn (string $action, ?object $target, ?string $reason, int $hoursAgo, array $meta = []) => AdminAuditLog::record($admin, $action, $target, $reason, $meta)
            ->forceFill(['created_at' => now()->subHours($hoursAgo)])->save();
        $log('user.suspend', $this->users['sofia.ramos'], $this->users['sofia.ramos']->suspended_reason, 48, ['until' => $this->users['sofia.ramos']->suspended_until?->toIso8601String()]);
        $log('user.revoke', $this->users['marco.tan'], 'Repeated fraudulent bookings', 144);
        $log('user.suspend', $this->users['diego.ramos'], 'Vehicle not returned (BG case under investigation)', 480);
        $log('host_application.approve', HostApplication::first(), null, 700);
        $log('settings.update', null, null, 900, ['service_fee_rate' => 7.5, 'commission_rate' => 15]);
        if ($license = DriverLicense::where('status', 'approved')->whereNotNull('reviewed_by')->first()) $log('verification.approve', $license, null, 1200);
    }

    protected function payment(Booking $b, string $type, string $method, int $amount, string $desc, Carbon $at, ?string $hint = null): void
    {
        $prefix = $type === 'refund' ? 'RF' : 'OR';
        Payment::create([
            'booking_id' => $b->id, 'user_id' => $b->renter_id, 'type' => $type, 'method' => $method, 'amount' => $amount,
            'status' => 'succeeded', 'receipt_no' => $prefix.'-'.$at->format('Y').'-'.($this->receipt++),
            'gateway_ref' => $method === 'deposit' ? null : strtoupper(substr(md5($b->reference.$type.$amount), 0, 4)).'-'.$at->format('ymdHis').'-'.mt_rand(100, 999),
            'account_hint' => $hint, 'description' => $desc, 'created_at' => $at, 'updated_at' => $at,
        ]);
    }

    /**
     * Creates one booking with its payments, inspections, settlement and payout records.
     * $state: upcoming | active | completed | cancelled | disputed
     */
    protected function booking(Vehicle $v, User $renter, Carbon $pickup, int $days, string $state, array $opt = []): Booking
    {
        $pricing = app(PricingService::class);
        $pickup = $pickup->copy()->utc();
        $return = $pickup->copy()->addDays($days);
        $rentalType = $opt['rental_type'] ?? 'self';
        $plan = $opt['plan'] ?? (['standard', 'standard', 'standard', 'plus', 'premium'][mt_rand(0, 4)]);
        $q = $pricing->quote($v, $pickup, $return, $rentalType, $plan, false);
        $created = $opt['created_at'] ?? $pickup->copy()->subDays(mt_rand(2, 12))->setTime(mt_rand(8, 21), mt_rand(0, 59));
        if ($created->isFuture()) $created = now()->subHours(mt_rand(1, 6));
        $method = $opt['method'] ?? ['gcash', 'gcash', 'maya', 'card', 'gcash', 'google_pay'][mt_rand(0, 5)];
        $hint = match ($method) {
            'gcash', 'maya' => '09'.mt_rand(15, 99).' ••• '.mt_rand(1000, 9999),
            'card' => '•••• '.mt_rand(1000, 9999),
            default => $method === 'google_pay' ? 'Google Pay' : 'Apple Pay',
        };
        $commission = (int) round(($q['rental_subtotal'] + $q['driver_fee_total']) * Settings::get('commission_rate') / 100);

        $b = Booking::create([
            'reference' => 'BG-'.(20400 + Booking::count() + 1), 'renter_id' => $renter->id, 'vehicle_id' => $v->id, 'host_id' => $v->host_id,
            'pickup_at' => $pickup, 'return_at' => $return, 'rental_type' => $rentalType, 'protection_plan' => $q['protection_plan'],
            'days' => $q['days'], 'daily_rate' => $q['daily_rate'], 'rental_subtotal' => $q['rental_subtotal'], 'driver_fee_total' => $q['driver_fee_total'],
            'protection_total' => $q['protection_total'], 'service_fee' => $q['service_fee'], 'total' => $q['total'],
            'security_deposit' => $q['security_deposit'], 'amount_paid' => $q['due_now'], 'status' => 'confirmed', 'payment_status' => 'paid',
            'deposit_status' => 'held', 'pickup_label' => $v->pickupLabel(), 'pickup_lat' => $v->lat, 'pickup_lng' => $v->lng,
            'driver_name' => $renter->name, 'driver_phone' => $renter->phone, 'driver_email' => $renter->email,
            'driver_license_no' => $rentalType === 'self' ? DriverLicense::where('user_id', $renter->id)->value('license_number') : null,
            'payment_method' => $method, 'agreement_accepted_at' => $created, 'agreement_version' => '2026.1', 'agreement_ip' => '112.198.'.mt_rand(1, 250).'.'.mt_rand(1, 250),
            'created_at' => $created, 'updated_at' => $created,
        ]);
        $this->payment($b, 'charge', $method, $q['due_now'], "Trip {$b->reference} – {$v->name} (includes ₱".number_format($q['security_deposit']).' refundable deposit)', $created, $hint);
        $b->log('created', 'Booking created and rental agreement v2026.1 accepted.', $renter->id);
        $b->events()->latest('id')->first()->update(['created_at' => $created]);

        if ($state === 'cancelled') {
            $cancelAt = $opt['cancelled_at'] ?? $created->copy()->addDays(1);
            $b->update(['status' => 'cancelled', 'cancelled_at' => $cancelAt, 'cancelled_by' => 'renter', 'cancel_reason' => $opt['reason'] ?? 'Change of plans',
                'payment_status' => 'refunded', 'deposit_status' => 'refunded']);
            $this->payment($b, 'refund', $method, $q['due_now'], 'Full refund for cancelled trip '.$b->reference, $cancelAt, $hint);
            return $b;
        }
        if ($state === 'upcoming') return $b;

        $odo = mt_rand(8000, 60000);
        $fuel = [75, 88, 100][mt_rand(0, 2)];
        $check = ['exterior' => true, 'interior' => true, 'tires' => true, 'lights' => true, 'engine_bay' => true, 'spare_tools' => true, 'documents' => true];
        $b->inspections()->create(['stage' => 'pickup', 'odometer' => $odo, 'fuel_level' => $fuel, 'checklist' => $check, 'notes' => 'All good. Photos taken together with renter.',
            'recorded_by' => $v->host_id, 'created_at' => $pickup, 'updated_at' => $pickup]);
        $b->update(['status' => 'active', 'actual_pickup_at' => $pickup->copy()->addMinutes(mt_rand(0, 25))]);
        if ($state === 'active') return $b;

        $lateMinutes = $opt['late_minutes'] ?? (mt_rand(1, 10) > 8 ? mt_rand(70, 240) : mt_rand(-60, 30));
        $actual = $return->copy()->addMinutes($lateMinutes);
        $late = $pricing->lateFee($v, $return, $actual);
        $b->inspections()->create(['stage' => 'return', 'odometer' => $odo + $days * mt_rand(60, 180), 'fuel_level' => $fuel, 'checklist' => $check,
            'notes' => $state === 'disputed' ? 'Deep scratch on rear bumper, not in pick-up photos.' : 'Returned clean, no new damage.',
            'recorded_by' => $v->host_id, 'created_at' => $actual, 'updated_at' => $actual]);
        $b->update(['status' => 'completed', 'actual_return_at' => $actual, 'late_hours' => $late['hours'], 'late_fee' => $late['fee']]);
        $v->increment('trips_count');

        if ($state === 'disputed') {
            Incident::create(['booking_id' => $b->id, 'reporter_id' => $v->host_id, 'type' => 'damage',
                'description' => 'Deep scratch and small dent on the rear bumper. It was not there in the pick-up photos. Repair shop estimate attached.',
                'amount_claimed' => 6500, 'status' => 'open', 'created_at' => $actual->copy()->addMinutes(20)]);
            $b->update(['deposit_status' => 'on_hold']);
            $b->log('incident', 'Host reported damage at return. Deposit on hold while our team reviews it.', $v->host_id);
            return $b;
        }

        $deposit = $q['security_deposit'];
        $fromDeposit = min($late['fee'], $deposit);
        $settledAt = $actual->copy()->addHours(2);
        if ($fromDeposit > 0) {
            $this->payment($b, 'late_fee', 'deposit', $fromDeposit, "Late return fee ({$late['hours']} h) – deducted from deposit for {$b->reference}", $settledAt);
        }
        if ($deposit - $fromDeposit > 0) {
            $this->payment($b, 'refund', $method, $deposit - $fromDeposit, "Security deposit returned for {$b->reference}", $settledAt, $hint);
        }
        $earnings = $q['rental_subtotal'] + $q['driver_fee_total'] - $commission + $late['fee'];
        $b->update([
            'deposit_refunded' => $deposit - $fromDeposit, 'deposit_status' => $fromDeposit > 0 ? 'partially_released' : 'released',
            'commission' => $commission, 'host_earnings' => $earnings, 'settled_at' => $settledAt,
        ]);
        $scheduled = $settledAt->copy()->addDays(3);
        Payout::create(['host_id' => $v->host_id, 'booking_id' => $b->id, 'amount' => $earnings,
            'status' => $scheduled->isPast() && $scheduled->lt(now()->subDays(2)) ? 'paid' : 'scheduled', 'scheduled_for' => $scheduled->toDateString(),
            'paid_at' => $scheduled->isPast() && $scheduled->lt(now()->subDays(2)) ? $scheduled : null,
            'reference' => $scheduled->lt(now()->subDays(2)) ? 'PO-'.$scheduled->format('ymd').'-'.str_pad((string) $b->id, 4, '0', STR_PAD_LEFT) : null]);

        if (($opt['review'] ?? (mt_rand(1, 10) <= 8))) {
            $comments = [
                5 => ['Spotless car and super smooth pick-up. Will definitely book again!', 'Host was very accommodating and the car was in perfect condition.', 'Clean, cold aircon, full tank. Perfect for our Oslob trip.', 'Handled the drive to Moalboal without a single issue. Quick replies the whole time.'],
                4 => ['Good car overall, pick-up took a few minutes longer than expected.', 'Comfortable ride. Small scratch on the side but it was noted in the photos.', 'Great value for the price.'],
                3 => ['Car was okay but could have been cleaner inside.'],
            ];
            $rating = [5, 5, 5, 5, 4, 4, 5, 3][mt_rand(0, 7)];
            Review::create(['booking_id' => $b->id, 'vehicle_id' => $v->id, 'renter_id' => $renter->id, 'rating' => $rating,
                'comment' => $comments[$rating][mt_rand(0, count($comments[$rating]) - 1)], 'created_at' => $actual->copy()->addHours(mt_rand(3, 30))]);
        }
        return $b;
    }

    protected function seedBookings(array $vehicles): void
    {
        $renters = collect($this->users)->filter(fn ($u) => $u->role === 'renter' && $u->verification_status === 'verified' && $u->status === 'active' && $u->username !== 'Test123')->values();
        $test = $this->users['Test123'];
        $byName = collect($vehicles)->keyBy(fn ($v) => $v->make.' '.$v->model);
        $reserved = []; // vehicle_id => list of [from, to] to avoid overlaps

        $free = function (Vehicle $v, Carbon $from, int $days) use (&$reserved) {
            $to = $from->copy()->addDays($days)->addHours(4);
            foreach ($reserved[$v->id] ?? [] as [$a, $b]) {
                if ($from->lt($b) && $to->gt($a)) return false;
            }
            $reserved[$v->id][] = [$from->copy()->subHours(4), $to];
            return true;
        };

        // --- Test123's own trips (show every state in "My trips" and "Billing") ---
        $mk = function ($name, $pickup, $days, $state, $opt = []) use ($byName, $test, $free) {
            $v = $byName[$name];
            $free($v, $pickup, $days);
            return $this->booking($v, $test, $pickup, $days, $state, $opt);
        };
        $mk('Toyota Fortuner', now(self::TZ)->addDays(6)->setTime(10, 0), 2, 'upcoming', ['plan' => 'standard', 'method' => 'gcash']);
        $mk('Toyota Rush', now(self::TZ)->addDays(15)->setTime(9, 0), 3, 'upcoming', ['plan' => 'plus', 'method' => 'card']);
        $mk('Toyota Vios', now(self::TZ)->subDays(20)->setTime(8, 0), 2, 'completed', ['review' => false, 'late_minutes' => -20, 'method' => 'maya']);
        $mk('Mitsubishi Montero Sport', now(self::TZ)->subMonths(2)->setTime(7, 0), 3, 'completed', ['review' => true, 'late_minutes' => 185, 'method' => 'gcash']);
        $mk('Honda City', now(self::TZ)->subMonths(4)->setTime(10, 0), 1, 'completed', ['review' => true, 'late_minutes' => 0, 'method' => 'google_pay']);
        $mk('Nissan Almera', now(self::TZ)->subDays(35)->setTime(13, 0), 2, 'cancelled', ['reason' => 'Flight was rescheduled', 'created_at' => now()->subDays(45), 'cancelled_at' => now()->subDays(40)]);

        // --- A live dispute for the admin to resolve ---
        $paolo = $this->users['paolo.cruz'];
        $everest = $byName['Ford Everest'];
        $free($everest, now(self::TZ)->subDays(4)->setTime(9, 0), 2);
        $this->booking($everest, $paolo, now(self::TZ)->subDays(4)->setTime(9, 0), 2, 'disputed', ['plan' => 'standard', 'late_minutes' => 10, 'method' => 'gcash']);

        // --- A theft case that's already been handled ---
        $diego = $this->users['diego.ramos'];
        $wigo = $byName['Toyota Wigo'];
        $free($wigo, now(self::TZ)->subDays(26)->setTime(10, 0), 3);
        $theft = $this->booking($wigo, $diego, now(self::TZ)->subDays(26)->setTime(10, 0), 3, 'active', ['method' => 'card']);
        Incident::create(['booking_id' => $theft->id, 'reporter_id' => $wigo->host_id, 'type' => 'theft',
            'description' => 'Renter did not return the vehicle and stopped answering calls. GPS tracker shows it in Danao. Police blotter filed at Lapu-Lapu PNP.',
            'amount_claimed' => 45000, 'status' => 'resolved', 'amount_approved' => 45000,
            'resolution_notes' => 'Vehicle recovered by PNP with missing battery. Renter account suspended, deposit forfeited and case referred to legal.',
            'resolved_by' => $this->users['Admin']->id, 'resolved_at' => now()->subDays(20), 'created_at' => now()->subDays(22)]);
        $theft->log('incident', 'Theft case resolved by admin. Renter account suspended.', $this->users['Admin']->id);
        $theft->update(['status' => 'completed', 'actual_return_at' => now()->subDays(20), 'deposit_status' => 'applied', 'payment_status' => 'balance_due',
            'damage_charge' => 45000, 'balance_due' => 45000 - $theft->security_deposit, 'settled_at' => now()->subDays(20)]);
        $this->payment($theft, 'damage', 'deposit', $theft->security_deposit, "Approved theft/damage charge – deducted from deposit for {$theft->reference}", now()->subDays(20));
        $diego->update(['status' => 'suspended']);

        // --- Active trips right now ---
        foreach ([['Toyota Hiace Grandia', 'andrea.santos', 1, 3, 'driver'], ['Kia Stonic', 'bea.villanueva', 2, 4, 'self'], ['Yamaha NMAX', 'mark.villareal', 0, 2, 'self']] as [$name, $u, $ago, $days, $rt]) {
            $v = $byName[$name];
            $p = now()->subDays($ago)->subHours(3)->setMinutes(0);
            $free($v, $p, $days);
            $this->booking($v, $this->users[$u], $p, $days, 'active', ['rental_type' => $rt]);
        }

        // --- An overdue trip so hosts can see late-return fees in action ---
        $vios = $byName['Toyota Vios'];
        $overduePickup = now()->subDays(2)->subHours(4)->setMinutes(0);
        $free($vios, $overduePickup, 2);
        $this->booking($vios, $this->users['clint.goden'], $overduePickup, 2, 'active', ['rental_type' => 'self', 'plan' => 'standard']);

        // --- Upcoming trips (some for host demos within the next day) ---
        foreach ([
            ['Toyota Avanza', 'nicole.tan', 0, 3], ['Toyota Innova', 'clint.goden', 1, 2], ['Isuzu mu-X', 'billy.ceriaca', 3, 4],
            ['Mitsubishi Xpander', 'trisha.yap', 5, 2], ['Honda Brio', 'carlo.dizon', 8, 3], ['Toyota Fortuner', 'andrea.santos', 12, 3],
            ['Ford Ranger', 'paolo.cruz', 4, 2], ['Hyundai Stargazer', 'bea.villanueva', 9, 2],
        ] as [$name, $u, $inDays, $days]) {
            $v = $byName[$name];
            $p = $inDays === 0 ? now(self::TZ)->addHours(5)->setMinutes(0) : now(self::TZ)->addDays($inDays)->setTime([8, 9, 10, 13][mt_rand(0, 3)], 0);
            if ($free($v, $p, $days)) $this->booking($v, $this->users[$u], $p, $days, 'upcoming', ['plan' => 'standard']);
        }

        // --- 12 months of completed and cancelled history ---
        $pool = collect($vehicles);
        for ($i = 0; $i < 170; $i++) {
            $v = $pool->random();
            $renter = $renters->random();
            $p = now()->subDays(mt_rand(6, 360))->setTime([7, 8, 9, 10, 13, 15][mt_rand(0, 5)], 0);
            $days = [1, 2, 2, 3, 3, 4, 5, 7][mt_rand(0, 7)];
            if (! $free($v, $p, $days)) continue;
            $state = mt_rand(1, 100) <= 9 ? 'cancelled' : 'completed';
            $rt = $v->with_driver_available && mt_rand(1, 3) === 1 ? 'driver' : 'self';
            $this->booking($v, $renter, $p, $days, $state, ['rental_type' => $rt]);
        }

        // Refresh vehicle ratings from the reviews we created.
        foreach (Vehicle::all() as $v) {
            $v->update(['rating_avg' => round((float) $v->reviews()->avg('rating'), 2), 'rating_count' => $v->reviews()->count()]);
        }
    }

    protected function seedExtras(array $vehicles): void
    {
        $test = $this->users['Test123'];
        $byName = collect($vehicles)->keyBy(fn ($v) => $v->make.' '.$v->model);

        foreach (['Mitsubishi Montero Sport', 'Toyota Vios', 'Toyota Hiace Grandia'] as $i => $name) {
            Favorite::create(['user_id' => $test->id, 'vehicle_id' => $byName[$name]->id, 'price_alert' => $i === 0, 'created_at' => now()->subDays(10 - $i)]);
        }
        foreach (['Toyota Fortuner', 'Toyota Hiace Grandia', 'Honda City', 'Kia Stonic'] as $i => $name) {
            RecentlyViewed::create(['user_id' => $test->id, 'vehicle_id' => $byName[$name]->id, 'viewed_at' => now()->subHours(2 + $i * 20)]);
        }

        HostApplication::create([
            'user_id' => $this->users['kim.navarro']->id, 'full_name' => 'Kim Navarro', 'phone' => '0945 118 2290', 'city' => 'Cordova',
            'address' => 'Day-as, Cordova, Cebu', 'vehicle_count' => 2, 'vehicle_types' => ['sedan', 'motorcycle'], 'business_name' => null,
            'payout_method' => 'gcash', 'payout_account_name' => 'Kim Navarro', 'payout_account_number' => '09451182290',
            'notes' => 'I have a 2021 Toyota Vios and a Honda Click that I only use on weekends.', 'status' => 'pending', 'created_at' => now()->subDays(1),
        ]);

        SupportTicket::create(['name' => 'Nicole Tan', 'email' => 'nicole.tan@byahego.test', 'user_id' => $this->users['nicole.tan']->id, 'topic' => 'booking',
            'message' => 'Hi! Can I add a second driver to my booking? My husband will share the driving on our trip to Oslob.', 'created_at' => now()->subHours(5)]);
        SupportTicket::create(['name' => 'Ramon Aquino', 'email' => 'ramon.aquino@example.com', 'topic' => 'hosting',
            'message' => 'I own three vans for airport transfers. Is there a fleet option for hosts with several vehicles?', 'created_at' => now()->subHours(28)]);

        $notes = [
            ['You\'re verified!', 'Your driver\'s license was approved. You can now book self-drive trips.', '/vehicles', 'success', 120],
            ['Deposit update', '₱5,000 of your deposit is on its way back to you.', '/account/billing', 'success', 400],
            ['Your trip is booked!', 'Toyota Fortuner 2023 · pick-up in 6 days. We\'ll remind you the day before.', '/account/trips', 'success', 30],
            ['Price drop on a saved car', 'Mitsubishi Montero Sport 2022 is one of the best-rated SUVs this month.', '/account/saved', 'info', 6],
        ];
        foreach ($notes as [$t, $b, $l, $k, $hoursAgo]) {
            UserNotification::create(['user_id' => $test->id, 'title' => $t, 'body' => $b, 'link' => $l, 'kind' => $k,
                'read_at' => $hoursAgo > 100 ? now() : null, 'created_at' => now()->subHours($hoursAgo)]);
        }
    }
}
