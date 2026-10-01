<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;

use App\Models\User;
use App\Models\Village;
use App\Models\VillageNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'regex:/^[0-9]{10}$/', 'unique:users,phone'],
            'email' => ['required', 'email:rfc', 'max:255', 'unique:users,email'],
            'houseNo' => ['required', 'string', 'max:50'],
            'villageId' => ['nullable', 'integer', 'exists:villages,id'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ], [
            'name.required' => 'กรุณากรอกชื่อและนามสกุล',
            'phone.required' => 'กรุณากรอกเบอร์โทรศัพท์',
            'phone.regex' => 'กรุณากรอกเบอร์โทรศัพท์เป็นตัวเลขให้ครบ 10 หลัก',
            'phone.unique' => 'เบอร์โทรศัพท์นี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบหรือใช้เมนูลืมรหัสผ่าน',
            'email.required' => 'กรุณากรอกอีเมลกู้คืนบัญชี',
            'email.email' => 'รูปแบบอีเมลไม่ถูกต้อง',
            'email.unique' => 'อีเมลนี้ผูกกับบัญชีอื่นอยู่แล้ว กรุณาใช้อีเมลอื่น หรือเข้าสู่ระบบด้วยบัญชีเดิม',
            'houseNo.required' => 'กรุณากรอกบ้านเลขที่',
            'villageId.exists' => 'ไม่พบหมู่บ้านที่เลือก กรุณาเลือกใหม่',
            'password.min' => 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร',
        ]);

        $user = User::create([
            'name' => $data['name'], 'phone' => $data['phone'], 'email' => Str::lower($data['email']), 'house_no' => $data['houseNo'], 'village_id' => $data['villageId'] ?? Village::where('moo', 5)->value('id'),
            'password' => $data['password'], 'role' => 'user', 'account_status' => 'pending',
        ]);

        User::query()
            ->whereIn('role', ['village_admin', 'staff'])
            ->where('account_status', 'approved')
            ->where('village_id', $user->village_id)
            ->pluck('id')
            ->each(fn ($adminId) => VillageNotification::create([
                'user_id' => $adminId,
                'title' => 'มีคำขอสมัครสมาชิกใหม่',
                'description' => $user->name.' · บ้านเลขที่ '.$user->house_no,
                'type' => 'user_registration',
                'data' => ['user_id' => $user->id, 'village_id' => $user->village_id],
            ]));

        return response()->json(['message' => 'Registration submitted for approval.', 'user' => $user], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate(['phone' => ['required', 'string'], 'password' => ['required', 'string']]);
        $user = User::where('phone', $data['phone'])->first();
        if (! $user || ! Hash::check($data['password'], $user->password)) {
            return response()->json(['message' => 'เบอร์โทรศัพท์หรือรหัสผ่านไม่ถูกต้อง'], 401);
        }
        if ($user->account_status !== 'approved') {
            return response()->json(['message' => 'Account is not approved.', 'account_status' => $user->account_status], 403);
        }
        $user->tokens()->delete();
        return response()->json(['user' => $user->load('village'), 'token' => $user->createToken('smart-village-web')->plainTextToken]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();
        return response()->json(['message' => 'Logged out.']);
    }

    public function updateRecoveryEmail(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->role === 'user', 403, 'การตั้งค่าบัญชีนี้สำหรับผู้ใช้งานประชาชนเท่านั้น');

        $data = $request->validate([
            'email' => ['required', 'email:rfc', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'current_password' => ['required', 'string'],
        ]);

        if (! Hash::check($data['current_password'], $user->password)) {
            return response()->json(['message' => 'รหัสผ่านปัจจุบันไม่ถูกต้อง'], 422);
        }

        $user->update(['email' => Str::lower($data['email'])]);

        return response()->json(['message' => 'บันทึกอีเมลกู้คืนแล้ว', 'user' => $user->fresh()]);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->role === 'user', 403, 'การเปลี่ยนรหัสผ่านด้วยตนเองสำหรับผู้ใช้งานประชาชนเท่านั้น');

        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed', 'different:current_password'],
        ]);

        if (! Hash::check($data['current_password'], $user->password)) {
            return response()->json(['message' => 'รหัสผ่านปัจจุบันไม่ถูกต้อง'], 422);
        }

        $user->forceFill(['password' => Hash::make($data['password'])])->save();
        $user->tokens()->delete();

        return response()->json(['message' => 'เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบใหม่']);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email:rfc']]);
        Password::sendResetLink(['email' => Str::lower($data['email'])]);

        // Always return the same response so outsiders cannot discover registered emails.
        return response()->json([
            'message' => 'If this email is registered, a password reset link has been sent.',
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email:rfc'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $status = Password::reset(
            [
                'email' => Str::lower($data['email']),
                'password' => $data['password'],
                'password_confirmation' => $request->input('password_confirmation'),
                'token' => $data['token'],
            ],
            function (User $user, string $password): void {
                $user->forceFill(['password' => Hash::make($password)])->save();
                $user->tokens()->delete();
                event(new PasswordReset($user));
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            return response()->json(['message' => __($status)], 422);
        }

        return response()->json(['message' => 'Password reset successfully.']);
    }
}
