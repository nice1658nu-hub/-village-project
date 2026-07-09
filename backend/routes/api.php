<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\BootstrapController;
use App\Http\Controllers\IncidentController;
use App\Http\Controllers\NewsController;
use App\Http\Controllers\NotificationTokenController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::get('/bootstrap', BootstrapController::class);

Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);

Route::post('/incidents', [IncidentController::class, 'store']);
Route::patch('/incidents/{incident}/status', [IncidentController::class, 'updateStatus']);
Route::delete('/incidents/{incident}', [IncidentController::class, 'destroy']);

Route::post('/news', [NewsController::class, 'store']);
Route::put('/news/{news}', [NewsController::class, 'update']);
Route::delete('/news/{news}', [NewsController::class, 'destroy']);

Route::delete('/users/{user}', [UserController::class, 'destroy']);
Route::post('/notification-tokens', [NotificationTokenController::class, 'store']);
