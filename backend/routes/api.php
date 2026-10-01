<?php

use App\Http\Controllers\Shared\AuthController;
use App\Http\Controllers\Shared\BootstrapController;
use App\Http\Controllers\Cases\IncidentController;
use App\Http\Controllers\Cases\IncidentFeedbackController;
use App\Http\Controllers\Shared\NewsController;
use App\Http\Controllers\Shared\NotificationController;
use App\Http\Controllers\Village\UserApprovalController;
use App\Http\Controllers\Village\StaffWorkflowController;
use App\Http\Controllers\Tao\BudgetSettingController;
use App\Http\Controllers\Tao\TaoWorkflowController;
use Illuminate\Support\Facades\Route;

// สาธารณะ: หน้าแรก สมัครสมาชิก และกู้รหัสผ่าน
Route::get('/bootstrap', [BootstrapController::class, 'publicData']);
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1');
Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:3,1');
Route::post('/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:5,1');

Route::middleware('auth:sanctum')->group(function () {
    // ใช้ร่วมกันทุกบทบาท
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', fn () => request()->user()->load('village'));
    Route::patch('/profile/recovery-email', [AuthController::class, 'updateRecoveryEmail'])->middleware('throttle:5,1');
    Route::patch('/profile/password', [AuthController::class, 'changePassword'])->middleware('throttle:5,1');
    Route::get('/dashboard/bootstrap', [BootstrapController::class, 'authenticated']);
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notification-tokens', [NotificationController::class, 'saveToken']);
    Route::patch('/notifications/{notification}/read', [NotificationController::class, 'markAsRead']);
    Route::get('/users', [UserApprovalController::class, 'index']);
    Route::patch('/users/{user}/status', [UserApprovalController::class, 'update']);
    Route::patch('/users/{user}/password', [UserApprovalController::class, 'resetPassword']);
    Route::post('/news', [NewsController::class, 'store']);
    Route::put('/news/{news}', [NewsController::class, 'update']);
    Route::delete('/news/{news}', [NewsController::class, 'destroy']);

    // ประชาชน: สร้างและติดตามเรื่องร้องทุกข์
    Route::post('/incidents', [IncidentController::class, 'store']);
    Route::put('/incidents/{incident}', [IncidentController::class, 'update']);
    Route::delete('/incidents/{incident}', [IncidentController::class, 'destroy']);
    Route::put('/incidents/{incident}/feedback', [IncidentFeedbackController::class, 'store']);
    // ผู้ดูแลหมู่บ้าน: รับงาน ดำเนินการ และส่งต่อ อบต.
    Route::patch('/incidents/{incident}/start', [StaffWorkflowController::class, 'start']);
    Route::post('/incidents/{incident}/progress', [StaffWorkflowController::class, 'progress']);
    Route::post('/incidents/{incident}/submit', [StaffWorkflowController::class, 'submit']);
    Route::patch('/incidents/{incident}/forward-to-tao', [TaoWorkflowController::class, 'forward']);
    // อบต.: พิจารณาการสนับสนุนและงบประมาณ
    Route::put('/incidents/{incident}/budget', [TaoWorkflowController::class, 'saveBudget']);
    Route::patch('/incidents/{incident}/budget/actual', [TaoWorkflowController::class, 'recordActual']);
    Route::patch('/incidents/{incident}/project', [TaoWorkflowController::class, 'updateProject']);
    Route::patch('/incidents/{incident}/status', [IncidentController::class, 'updateStatus']);

    Route::middleware('admin')->group(function () {
        Route::put('/budget-settings', [BudgetSettingController::class, 'update']);
        Route::post('/staff', [StaffWorkflowController::class, 'createStaff']);
        Route::patch('/incidents/{incident}/assign', [StaffWorkflowController::class, 'assign']);
        Route::patch('/incidents/{incident}/review', [StaffWorkflowController::class, 'review']);
        Route::patch('/incidents/{incident}/budget/review', [TaoWorkflowController::class, 'reviewBudget']);
    });
});
