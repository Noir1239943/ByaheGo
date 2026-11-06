<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Media;
use App\Models\Vehicle;
use App\Support\ImageHash;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\Rule;
use finfo;

class MediaController extends Controller
{
    public const PUBLIC_PURPOSES = ['vehicle_photo'];
    /** Purposes that identify a person; these get the stricter resolution rule and a perceptual hash. */
    public const ID_PURPOSES = ['license_front', 'license_back', 'selfie'];
    public const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
    public const MAX_PIXELS = 16_000_000;

    public function store(Request $request)
    {
        $data = $request->validate([
            'file' => ['required', 'file', 'mimes:jpg,jpeg,png,webp', 'max:8192'],
            'purpose' => ['required', Rule::in(['vehicle_photo', 'license_front', 'license_back', 'selfie', 'vehicle_or', 'vehicle_cr', 'vehicle_ctpl', 'incident', 'inspection'])],
        ], [
            'file.mimes' => 'Please upload a JPG, PNG or WEBP photo.',
            'file.max' => 'That photo is too large. Please use one under 8 MB.',
        ]);
        $file = $data['file'];
        $contents = file_get_contents($file->getRealPath());
        $size = @getimagesizefromstring($contents);
        if (! $size) {
            return $this->reject("We couldn't read that image. Please try another photo.");
        }
        // Trust the file's real content, not its name or the browser-supplied type.
        $mime = (new finfo(FILEINFO_MIME_TYPE))->buffer($contents);
        if (! in_array($mime, self::ALLOWED_MIMES, true) || $mime !== $size['mime']) {
            return $this->reject("That file isn't a real JPG, PNG or WEBP photo. Please upload a photo.");
        }
        [$w, $h] = [$size[0], $size[1]];
        if ($w * $h > self::MAX_PIXELS) {
            return $this->reject('That photo is too large in dimensions. Please use a regular phone or camera photo.');
        }
        $isId = in_array($data['purpose'], self::ID_PURPOSES, true);
        if (min($w, $h) < ($isId ? 320 : 200) || max($w, $h) < ($isId ? 480 : 300)) {
            return $this->reject($isId ? 'That photo is too small to read. Please retake it closer to the camera and in good light.' : 'That photo is too small. Please use a larger one.');
        }
        $media = Media::create([
            'user_id' => $request->user()->id,
            'purpose' => $data['purpose'],
            'visibility' => in_array($data['purpose'], self::PUBLIC_PURPOSES, true) ? 'public' : 'private',
            'mime' => $mime,
            'size' => strlen($contents),
            'width' => $w,
            'height' => $h,
            'sha1' => sha1($contents),
            'phash' => $isId ? ImageHash::dhash($contents) : null,
            'data' => base64_encode($contents),
        ]);
        return response()->json(['id' => $media->id, 'url' => $media->url(), 'width' => $media->width, 'height' => $media->height], 201);
    }

    protected function resize(string $bytes, int $width): ?string
    {
        $src = @imagecreatefromstring($bytes);
        if (! $src) return null;
        $dst = imagescale($src, $width);
        if (! $dst) { imagedestroy($src); return null; }
        ob_start();
        imagejpeg($dst, null, 75);
        $out = (string) ob_get_clean();
        imagedestroy($src);
        imagedestroy($dst);
        return $out;
    }

    protected function reject(string $message)
    {
        return response()->json(['message' => $message, 'errors' => ['file' => [$message]]], 422);
    }

    public function show(Request $request, int $id)
    {
        // Only the small columns first: the photo itself (a few MB of base64) is not read until it is actually needed.
        $media = Media::select(['id', 'user_id', 'purpose', 'visibility', 'mime', 'width', 'sha1'])->findOrFail($id);
        if ($media->visibility !== 'public') {
            $user = Auth::guard('sanctum')->user();
            $allowed = $user && ($user->isAdmin() || $user->id === $media->user_id);
            // Check-in and check-out photos belong to the booking: its renter and host can see them (admins already can).
            if (! $allowed && $user && $media->purpose === 'inspection') {
                $allowed = \App\Models\InspectionPhoto::where('media_id', $id)->whereHas('booking', fn ($b) => $b->where('renter_id', $user->id)->orWhere('host_id', $user->id))->exists();
            }
            if (! $allowed && $user && in_array($media->purpose, ['vehicle_or', 'vehicle_cr', 'vehicle_ctpl'], true)) {
                $allowed = Vehicle::where('host_id', $user->id)->where(fn ($q) => $q->where('or_media_id', $id)->orWhere('cr_media_id', $id)->orWhere('ctpl_media_id', $id))->exists();
            }
            if (! $allowed) abort(404);
        }
        // ?w=480 returns a small JPEG copy for grids, so a page of ten photos doesn't download ten full-size originals.
        $w = (int) $request->query('w');
        $thumb = $w >= 120 && $w <= 1200 && $media->width > $w;

        // A stored photo never changes (a new upload is a new id), so the browser can keep it for good and only ever
        // asks "has it changed?" with its ETag. Photos of people and documents are never kept.
        $keep = $media->visibility === 'public' ? 'public' : ($media->purpose === 'inspection' ? 'private' : null);
        $headers = $keep
            ? ['Cache-Control' => $keep.', max-age=31536000, immutable'] + ($keep === 'private' ? ['Vary' => 'Authorization'] : [])
            : ['Cache-Control' => 'private, no-store'];
        $etag = $media->sha1 ? '"'.$media->sha1.($thumb ? '-w'.$w : '').'"' : null;
        if ($etag && $keep) {
            $headers['ETag'] = $etag;
            if (in_array($etag, array_map('trim', explode(',', str_replace('W/', '', (string) $request->header('If-None-Match')))), true)) {
                return response('', 304, $headers);
            }
        }

        $key = 'media.thumb.'.$id.'.'.$w;
        $out = $thumb ? Cache::get($key) : null;
        $isThumb = $out !== null;
        if ($out === null) {
            $bytes = base64_decode((string) Media::whereKey($id)->value('data'));
            $small = $thumb ? $this->resize($bytes, $w) : null;
            $isThumb = $small !== null && $small !== '';
            $out = $isThumb ? $small : $bytes;
            if ($isThumb && $keep) Cache::put($key, $out, now()->addDay());
        }
        return response($out, 200, $headers + ['Content-Type' => $isThumb ? 'image/jpeg' : $media->mime]);
    }
}
