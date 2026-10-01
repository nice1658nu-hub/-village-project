<?php

use App\Http\Controllers\Shared\DatabaseViewerController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Read-only database presentation page. The controller returns 404 outside local mode.
Route::get('/database', [DatabaseViewerController::class, 'index'])->name('database.viewer');
