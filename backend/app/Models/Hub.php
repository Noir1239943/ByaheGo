<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Hub extends Model
{
    protected $fillable = ['name', 'address', 'city', 'lat', 'lng', 'hours', 'parking_notes'];
    protected $casts = ['lat' => 'float', 'lng' => 'float'];
}
