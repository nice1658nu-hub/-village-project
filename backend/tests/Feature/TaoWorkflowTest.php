<?php

namespace Tests\Feature;

use App\Models\Incident;
use App\Models\User;
use App\Models\Village;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TaoWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_coordinator_dashboard_is_scoped_to_own_village(): void
    {
        $village = Village::where('moo', 5)->firstOrFail();
        $otherVillage = Village::where('moo', 6)->firstOrFail();
        $coordinator = User::factory()->create(['role' => 'staff', 'village_id' => $village->id]);
        $resident = User::factory()->create(['village_id' => $village->id]);
        $otherResident = User::factory()->create(['village_id' => $otherVillage->id]);
        Incident::create(['user_id' => $resident->id, 'village_id' => $village->id, 'title' => 'เรื่องในหมู่บ้าน', 'category' => 'อื่นๆ', 'description' => 'รายละเอียด', 'location' => 'หมู่ 5', 'lat' => 17.11, 'lng' => 100.19]);
        Incident::create(['user_id' => $otherResident->id, 'village_id' => $otherVillage->id, 'title' => 'เรื่องหมู่อื่น', 'category' => 'อื่นๆ', 'description' => 'รายละเอียด', 'location' => 'หมู่ 6', 'lat' => 17.12, 'lng' => 100.20]);

        $this->actingAs($coordinator)->getJson('/api/dashboard/bootstrap')->assertOk()->assertJsonCount(1, 'incidents')->assertJsonPath('incidents.0.title', 'เรื่องในหมู่บ้าน');
    }

    public function test_new_village_admin_role_is_isolated_and_tao_role_sees_all_villages(): void
    {
        $villageFive = Village::where('moo', 5)->firstOrFail();
        $villageSix = Village::where('moo', 6)->firstOrFail();
        $villageAdmin = User::factory()->create(['role' => 'village_admin', 'village_id' => $villageFive->id]);
        $tao = User::factory()->create(['role' => 'tao', 'village_id' => null]);
        $residentFive = User::factory()->pending()->create(['village_id' => $villageFive->id]);
        $residentSix = User::factory()->pending()->create(['village_id' => $villageSix->id]);

        $this->actingAs($villageAdmin)->patchJson("/api/users/{$residentFive->id}/status", ['account_status' => 'approved'])->assertOk();
        $this->actingAs($villageAdmin)->patchJson("/api/users/{$residentSix->id}/status", ['account_status' => 'approved'])->assertForbidden();

        $this->actingAs($tao)->getJson('/api/dashboard/bootstrap')->assertOk()->assertJsonPath('users.0.role', fn ($role) => in_array($role, ['user', 'village_admin'], true));
    }
}
