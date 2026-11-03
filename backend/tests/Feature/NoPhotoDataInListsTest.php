<?php

namespace Tests\Feature;

use App\Models\DriverLicense;
use App\Models\Media;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

/** Photos live in the database as base64, so list endpoints must only ever point at them by id/URL. */
class NoPhotoDataInListsTest extends TestCase
{
    protected function bigPhoto(int $seed): UploadedFile
    {
        mt_srand($seed);
        $img = imagecreatetruecolor(1200, 800);
        for ($i = 0; $i < 400; $i++) {
            imagefilledrectangle($img, mt_rand(0, 1200), mt_rand(0, 800), mt_rand(0, 1200), mt_rand(0, 800), imagecolorallocate($img, mt_rand(0, 255), mt_rand(0, 255), mt_rand(0, 255)));
        }
        ob_start();
        imagejpeg($img, null, 92);
        return UploadedFile::fake()->createWithContent("big{$seed}.jpg", ob_get_clean());
    }

    public function test_list_endpoints_never_include_photo_data(): void
    {
        $admin = $this->admin();
        $v = $this->vehicle();
        $renter = $this->verifiedRenter();
        foreach ([1, 2, 3] as $seed) {
            $id = $this->as($renter)->post('/api/media', ['file' => $this->bigPhoto($seed), 'purpose' => 'vehicle_photo'], ['Accept' => 'application/json'])->assertCreated()->json('id');
            $v->photos()->create(['media_id' => $id, 'position' => $seed]);
        }
        $front = $this->as($renter)->post('/api/media', ['file' => $this->bigPhoto(4), 'purpose' => 'license_front'], ['Accept' => 'application/json'])->json('id');
        DriverLicense::where('user_id', $renter->id)->update(['front_media_id' => $front]);
        $ref = $this->book($renter, $v)->assertCreated()->json('reference');
        $this->assertGreaterThan(20000, strlen((string) Media::find($front)->data)); // there is real photo data to leak

        $responses = [
            $this->guest()->getJson('/api/vehicles'),
            $this->guest()->getJson("/api/vehicles/{$v->id}"),
            $this->guest()->getJson('/api/vehicles/map'),
            $this->as($renter)->getJson('/api/bookings'),
            $this->as($renter)->getJson("/api/bookings/{$ref}"),
            $this->as($renter)->getJson('/api/me/billing'),
            $this->as($renter)->getJson('/api/verification'),
            $this->as($admin)->getJson('/api/admin/verifications?status=all'),
            $this->as($admin)->getJson('/api/admin/bookings'),
            $this->as($admin)->getJson('/api/admin/listings?status=all'),
            $this->as($admin)->getJson('/api/admin/users'),
            $this->as($admin)->getJson("/api/admin/users/{$renter->id}"),
        ];
        foreach ($responses as $i => $r) {
            $r->assertOk();
            $body = $r->getContent();
            $this->assertLessThan(60000, strlen($body), "response #{$i} is suspiciously large");
            $this->assertSame(0, preg_match('/[A-Za-z0-9+\/=]{2000,}/', $body), "response #{$i} contains a long base64-looking string");
        }
    }
}
