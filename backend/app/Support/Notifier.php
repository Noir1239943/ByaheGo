<?php

namespace App\Support;

use App\Models\User;
use App\Models\UserNotification;

class Notifier
{
    public static function send(User|int $user, string $title, string $body, ?string $link = null, string $kind = 'info'): void
    {
        UserNotification::create([
            'user_id' => $user instanceof User ? $user->id : $user,
            'title' => $title,
            'body' => $body,
            'link' => $link,
            'kind' => $kind,
        ]);
    }

    public static function admins(string $title, string $body, ?string $link = null, string $kind = 'info'): void
    {
        User::where('role', 'admin')->pluck('id')->each(fn ($id) => static::send($id, $title, $body, $link, $kind));
    }
}
