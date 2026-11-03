<?php

use Illuminate\Support\Facades\Route;

Route::get('/', fn () => response()->json([
    'name' => 'ByaheGo API',
    'status' => 'ok',
    'docs' => 'All endpoints live under /api',
]));
