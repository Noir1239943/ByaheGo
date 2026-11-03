<?php

namespace App\Support;

/**
 * Perceptual "difference hash" (dHash) built on PHP's GD extension. Two photos of the same scene get hashes with a
 * small Hamming distance even after resizing or re-compression, which catches reused / near-identical uploads.
 */
class ImageHash
{
    /** Hashes at or below this Hamming distance (of 64 bits) are treated as the same picture. */
    public const NEAR_DUPLICATE_DISTANCE = 10;
    /** Hashes within this distance are suspiciously alike (e.g. two shots of the same screen) and get a warning. */
    public const SIMILAR_DISTANCE = 20;

    public static function available(): bool
    {
        return extension_loaded('gd') && function_exists('imagecreatefromstring');
    }

    /** 16 hex characters, or null when GD is missing, the image can't be read, or it has no detail (blank). */
    public static function dhash(string $bytes): ?string
    {
        if (! self::available()) return null;
        $src = @imagecreatefromstring($bytes);
        if (! $src) return null;

        // Shrink in two steps so the final 9x8 sample averages many pixels instead of aliasing.
        $mid = imagecreatetruecolor(72, 64);
        imagecopyresampled($mid, $src, 0, 0, 0, 0, 72, 64, imagesx($src), imagesy($src));
        imagedestroy($src);
        $small = imagecreatetruecolor(9, 8);
        imagecopyresampled($small, $mid, 0, 0, 0, 0, 9, 8, 72, 64);
        imagedestroy($mid);

        $gray = [];
        for ($y = 0; $y < 8; $y++) {
            for ($x = 0; $x < 9; $x++) {
                $rgb = imagecolorat($small, $x, $y);
                $gray[$y][$x] = 0.299 * (($rgb >> 16) & 255) + 0.587 * (($rgb >> 8) & 255) + 0.114 * ($rgb & 255);
            }
        }
        imagedestroy($small);

        $flat = array_merge(...$gray);
        if (max($flat) - min($flat) < 8) return null; // blank / single-colour image: nothing to compare

        $bits = '';
        for ($y = 0; $y < 8; $y++) {
            for ($x = 0; $x < 8; $x++) $bits .= $gray[$y][$x] > $gray[$y][$x + 1] ? '1' : '0';
        }
        return sprintf('%08x%08x', bindec(substr($bits, 0, 32)), bindec(substr($bits, 32)));
    }

    public static function distance(string $a, string $b): int
    {
        $d = 0;
        foreach ([[0, 8], [8, 8]] as [$from, $len]) {
            $x = hexdec(substr($a, $from, $len)) ^ hexdec(substr($b, $from, $len));
            while ($x) { $d += $x & 1; $x >>= 1; }
        }
        return $d;
    }
}
