<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Media;
use App\Models\Vehicle;
use App\Support\ImageHash;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
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
            'purpose' => ['required', Rule::in(['vehicle_photo', 'license_front', 'license_back', 'selfie', 'vehicle_or', 'vehicle_cr', 'incident', 'inspection'])],
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

    protected function reject(string $message)
    {
        return response()->json(['message' => $message, 'errors' => ['file' => [$message]]], 422);
    }

    public function show(Request $request, int $id)
    {
        $media = Media::findOrFail($id);
        if ($media->visibility !== 'public') {
            $user = Auth::guard('sanctum')->user();
            $allowed = $user && ($user->isAdmin() || $user->id === $media->user_id);
            if (! $allowed && $user && in_array($media->purpose, ['vehicle_or', 'vehicle_cr'], true)) {
                $allowed = Vehicle::where('host_id', $user->id)->where(fn ($q) => $q->where('or_media_id', $id)->orWhere('cr_media_id', $id))->exists();
            }
            if (! $allowed) abort(404);
        }
        return response(base64_decode($media->data), 200, [
            'Content-Type' => $media->mime,
            'Cache-Control' => $media->visibility === 'public' ? 'public, max-age=604800, immutable' : 'private, no-store',
        ]);
    }
}
