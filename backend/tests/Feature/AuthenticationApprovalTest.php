<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Village;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Auth\Notifications\ResetPassword as ResetPasswordNotification;
use Tests\TestCase;

class AuthenticationApprovalTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_creates_a_pending_account_without_a_token(): void
    {
        $village = Village::where('moo', 5)->firstOrFail();
        $villageAdmin = User::factory()->create([
            'role' => 'village_admin', 'village_id' => $village->id, 'account_status' => 'approved',
        ]);
        $response = $this->postJson('/api/register', [
            'name' => 'สมชาย ใจดี', 'phone' => '0812345678', 'houseNo' => '99/10',
            'password' => 'password123', 'password_confirmation' => 'password123',
            'email' => 'resident@example.com', 'villageId' => $village->id,
        ]);

        $response->assertCreated()->assertJsonPath('user.account_status', 'pending')->assertJsonMissing(['token']);
        $this->assertDatabaseHas('users', ['phone' => '0812345678', 'account_status' => 'pending']);
        $this->assertDatabaseHas('village_notifications', [
            'user_id' => $villageAdmin->id, 'type' => 'user_registration', 'title' => 'มีคำขอสมัครสมาชิกใหม่',
        ]);
    }

    public function test_pending_account_cannot_login(): void
    {
        User::factory()->pending()->create(['phone' => '0812345678', 'password' => 'password123']);
        $this->postJson('/api/login', ['phone' => '0812345678', 'password' => 'password123'])
            ->assertForbidden()->assertJsonPath('account_status', 'pending');
    }

    public function test_admin_can_approve_a_pending_account_and_user_can_login(): void
    {
        $admin = User::factory()->admin()->create();
        $user = User::factory()->pending()->create(['phone' => '0812345678', 'password' => 'password123']);

        $this->actingAs($admin)->patchJson("/api/users/{$user->id}/status", ['account_status' => 'approved'])
            ->assertOk()->assertJsonPath('user.account_status', 'approved');

        $this->postJson('/api/login', ['phone' => '0812345678', 'password' => 'password123'])
            ->assertOk()->assertJsonStructure(['user', 'token']);
    }

    public function test_regular_user_cannot_approve_accounts(): void
    {
        $user = User::factory()->create();
        $pending = User::factory()->pending()->create();
        $this->actingAs($user)->patchJson("/api/users/{$pending->id}/status", ['account_status' => 'approved'])->assertForbidden();
    }

    public function test_admin_can_reset_a_resident_password_and_existing_sessions_are_revoked(): void
    {
        $admin = User::factory()->admin()->create();
        $user = User::factory()->create(['phone' => '0812345678', 'password' => 'old-password']);
        $user->createToken('existing-session');

        $this->actingAs($admin)->patchJson("/api/users/{$user->id}/password", [
            'password' => 'new-password-123',
            'password_confirmation' => 'new-password-123',
        ])->assertOk();

        $user->refresh();
        $this->assertTrue(Hash::check('new-password-123', $user->password));
        $this->assertCount(0, $user->tokens);
        $this->postJson('/api/login', ['phone' => '0812345678', 'password' => 'new-password-123'])
            ->assertOk()->assertJsonStructure(['user', 'token']);
    }

    public function test_regular_user_cannot_reset_another_users_password(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();

        $this->actingAs($user)->patchJson("/api/users/{$other->id}/password", [
            'password' => 'new-password-123',
            'password_confirmation' => 'new-password-123',
        ])->assertForbidden();
    }

    public function test_user_can_reset_password_through_recovery_email_without_admin(): void
    {
        Notification::fake();
        $user = User::factory()->create([
            'phone' => '0812345678',
            'email' => 'resident@example.com',
            'password' => 'old-password',
        ]);
        $user->createToken('existing-session');

        $this->postJson('/api/forgot-password', ['email' => 'resident@example.com'])->assertOk();

        $token = null;
        Notification::assertSentTo($user, ResetPasswordNotification::class, function ($notification) use (&$token) {
            $token = $notification->token;
            return true;
        });

        $this->postJson('/api/reset-password', [
            'token' => $token,
            'email' => 'resident@example.com',
            'password' => 'new-password-123',
            'password_confirmation' => 'new-password-123',
        ])->assertOk();

        $user->refresh();
        $this->assertTrue(Hash::check('new-password-123', $user->password));
        $this->assertCount(0, $user->tokens);
        $this->postJson('/api/login', ['phone' => '0812345678', 'password' => 'new-password-123'])->assertOk();
    }

    public function test_forgot_password_does_not_reveal_unknown_emails(): void
    {
        Notification::fake();
        $this->postJson('/api/forgot-password', ['email' => 'unknown@example.com'])
            ->assertOk()->assertJsonStructure(['message']);
    }

    public function test_user_can_update_recovery_email_with_current_password(): void
    {
        $user = User::factory()->create(['email' => 'old@example.com', 'password' => 'current-password']);

        $this->actingAs($user)->patchJson('/api/profile/recovery-email', [
            'email' => 'new@example.com',
            'current_password' => 'current-password',
        ])->assertOk()->assertJsonPath('user.email', 'new@example.com');

        $this->assertDatabaseHas('users', ['id' => $user->id, 'email' => 'new@example.com']);
    }

    public function test_user_cannot_update_recovery_email_with_wrong_password(): void
    {
        $user = User::factory()->create(['email' => 'old@example.com', 'password' => 'current-password']);

        $this->actingAs($user)->patchJson('/api/profile/recovery-email', [
            'email' => 'new@example.com',
            'current_password' => 'wrong-password',
        ])->assertUnprocessable();

        $this->assertDatabaseHas('users', ['id' => $user->id, 'email' => 'old@example.com']);
    }

    public function test_user_can_change_own_password_and_sessions_are_revoked(): void
    {
        $user = User::factory()->create(['phone' => '0888888888', 'password' => 'current-password']);
        $user->createToken('old-session');

        $this->actingAs($user)->patchJson('/api/profile/password', [
            'current_password' => 'current-password',
            'password' => 'safer-new-password-2026',
            'password_confirmation' => 'safer-new-password-2026',
        ])->assertOk();

        $user->refresh();
        $this->assertTrue(Hash::check('safer-new-password-2026', $user->password));
        $this->assertCount(0, $user->tokens);
    }

    public function test_tao_and_village_admin_cannot_use_citizen_account_settings(): void
    {
        foreach (['tao', 'village_admin'] as $role) {
            $official = User::factory()->create([
                'role' => $role,
                'password' => 'current-password',
            ]);

            $this->actingAs($official)->patchJson('/api/profile/recovery-email', [
                'email' => "{$role}@example.com",
                'current_password' => 'current-password',
            ])->assertForbidden();

            $this->actingAs($official)->patchJson('/api/profile/password', [
                'current_password' => 'current-password',
                'password' => 'safer-new-password-2026',
                'password_confirmation' => 'safer-new-password-2026',
            ])->assertForbidden();
        }
    }

    public function test_login_is_rate_limited_after_repeated_failures(): void
    {
        User::factory()->create(['phone' => '0899999999', 'password' => 'correct-password']);

        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.10'])
                ->postJson('/api/login', ['phone' => '0899999999', 'password' => 'wrong-password'])
                ->assertUnauthorized();
        }

        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.10'])
            ->postJson('/api/login', ['phone' => '0899999999', 'password' => 'wrong-password'])
            ->assertTooManyRequests();
    }
}
