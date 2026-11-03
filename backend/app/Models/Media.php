<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Media extends Model
{
    protected $fillable = ['user_id', 'purpose', 'visibility', 'mime', 'size', 'width', 'height', 'sha1', 'phash', 'data'];
    protected $hidden = ['data'];

    public function url(): string
    {
        return url('/api/media/'.$this->id);
    }
}
