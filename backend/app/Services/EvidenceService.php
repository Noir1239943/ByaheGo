<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Media;
use Barryvdh\DomPDF\Facade\Pdf;

/**
 * One PDF an admin can hand to the police or an insurer: who rented (verified identity), the signed contract, the booking and
 * payment records, every check-in and check-out photo with its metadata, and the incident timeline. Photos are shrunk so the file stays small.
 */
class EvidenceService
{
    public function __construct(protected AgreementService $agreements) {}

    /** A small JPEG copy of a stored image as a data URI (for the PDF only; the original is never changed). */
    protected function thumb(?int $mediaId, int $max): ?string
    {
        $media = $mediaId ? Media::find($mediaId) : null;
        if (! $media) return null;
        $src = @imagecreatefromstring((string) base64_decode($media->data));
        if (! $src) return null;
        [$w, $h] = [imagesx($src), imagesy($src)];
        $scale = min(1, $max / max($w, $h));
        $dst = imagecreatetruecolor(max(1, (int) round($w * $scale)), max(1, (int) round($h * $scale)));
        imagecopyresampled($dst, $src, 0, 0, 0, 0, imagesx($dst), imagesy($dst), $w, $h);
        ob_start();
        imagejpeg($dst, null, 72);
        $jpeg = (string) ob_get_clean();
        imagedestroy($src);
        imagedestroy($dst);
        return 'data:image/jpeg;base64,'.base64_encode($jpeg);
    }

    public function pdf(Booking $b): string
    {
        $b->loadMissing(['renter.latestLicense', 'host', 'vehicle', 'agreement', 'payments.invoice', 'events.actor', 'incidents.reporter', 'inspections.photos.uploader']);
        $license = $b->renter->latestLicense;
        $sections = $b->agreement ? $this->agreements->sectionsFromText($b->agreement->text)[1] : [];

        $sets = [];
        foreach (['checkin' => 'Check-in (before the trip)', 'checkout' => 'Check-out (return)'] as $stage => $title) {
            $inspection = $b->inspections->firstWhere('stage', $stage);
            if (! $inspection) continue;
            $sets[] = [
                'title' => $title, 'inspection' => $inspection,
                'photos' => $inspection->photos->map(fn ($p) => [
                    'p' => $p, 'img' => $this->thumb($p->media_id, 420),
                    'label' => (TripService::ANGLES + TripService::EXTRA_ANGLES)[$p->angle] ?? $p->angle,
                    'by' => $p->uploader_id === $b->host_id ? 'host' : 'renter',
                ]),
            ];
        }

        return Pdf::loadView('pdf.evidence', [
            'b' => $b, 'license' => $license, 'sections' => $sections, 'sets' => $sets,
            'idPhotos' => $license ? ['License front' => $this->thumb($license->front_media_id, 520), 'License back' => $this->thumb($license->back_media_id, 520), 'Selfie' => $this->thumb($license->selfie_media_id, 360)] : [],
            'generatedAt' => now()->timezone('Asia/Manila')->format('M j, Y g:i A'),
        ])->setPaper('a4')->setOption(['enable_font_subsetting' => true])->output();
    }
}
