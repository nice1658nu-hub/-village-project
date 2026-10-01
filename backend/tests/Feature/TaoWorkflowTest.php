<?php

namespace Tests\Feature;

use App\Models\Incident;
use App\Models\User;
use App\Models\Village;
use App\Models\VillageNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class TaoWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_coordinator_can_submit_budget_only_for_own_village_and_tao_can_approve_it(): void
    {
        $village = Village::where('moo', 5)->firstOrFail();
        $otherVillage = Village::where('moo', 6)->firstOrFail();
        $tao = User::factory()->admin()->create();
        $coordinator = User::factory()->create(['role' => 'village_admin', 'village_id' => $village->id]);
        $resident = User::factory()->create(['village_id' => $village->id]);
        $otherResident = User::factory()->create(['village_id' => $otherVillage->id]);

        $incident = Incident::create(['user_id' => $resident->id, 'village_id' => $village->id, 'title' => 'ถนนชำรุด', 'category' => 'สาธารณูปโภค (ถนน/ท่อ)', 'description' => 'ผิวถนนเสียหาย', 'location' => 'ถนนกลางหมู่บ้าน', 'lat' => 17.11, 'lng' => 100.19]);
        $otherIncident = Incident::create(['user_id' => $otherResident->id, 'village_id' => $otherVillage->id, 'title' => 'ไฟดับ', 'category' => 'ไฟฟ้า/แสงสว่าง', 'description' => 'ไฟดับ', 'location' => 'หมู่ 6', 'lat' => 17.12, 'lng' => 100.20]);

        $proposal = ['project_title' => 'โครงการซ่อมถนนกลางหมู่บ้าน', 'reason' => 'ต้องใช้วัสดุซ่อมถนน', 'affected_people' => 120, 'urgency' => 'urgent', 'estimated_amount' => 25000, 'items' => [], 'submit' => true];
        $this->actingAs($coordinator)->putJson("/api/incidents/{$incident->id}/budget", $proposal)
            ->assertOk()->assertJsonPath('budget_request.status', 'submitted');

        $this->actingAs($coordinator)->putJson("/api/incidents/{$incident->id}/budget", [...$proposal, 'reason' => 'แก้ยอดระหว่างรอ', 'estimated_amount' => 1])
            ->assertStatus(409);

        $this->actingAs($coordinator)->patchJson("/api/incidents/{$incident->id}/budget/review", ['decision' => 'approve', 'approved_amount' => 1])
            ->assertForbidden();

        $this->actingAs($coordinator)->putJson("/api/incidents/{$otherIncident->id}/budget", [...$proposal, 'reason' => 'อยู่นอกหมู่บ้าน', 'estimated_amount' => 1000])->assertForbidden();

        $this->actingAs($tao)->patchJson("/api/incidents/{$incident->id}/budget/review", ['decision' => 'approve', 'approved_amount' => 22000, 'fiscal_year' => '2569', 'funding_source' => 'งบกลาง'])
            ->assertOk()->assertJsonPath('budget_request.status', 'approved')->assertJsonPath('budget_request.approved_amount', '22000.00');

        $this->assertDatabaseHas('audit_logs', ['action' => 'budget.reviewed', 'subject_id' => $incident->budgetRequest->id]);
        $this->assertDatabaseHas('village_notifications', [
            'user_id' => $coordinator->id,
            'type' => 'budget',
            'title' => 'งบประมาณได้รับอนุมัติ',
        ]);
        $this->assertFalse(VillageNotification::where('user_id', $resident->id)->where('type', 'budget')->exists());

        $this->actingAs($tao)->patchJson("/api/incidents/{$incident->id}/project", [
            'project_status' => 'in_progress', 'executor' => 'กองช่าง อบต.',
            'start_date' => '2026-10-01', 'expected_end_date' => '2026-10-31',
            'progress_percent' => 40, 'actual_amount' => 8000,
            'project_note' => 'เริ่มปรับพื้นผิวถนน',
        ])->assertOk()->assertJsonPath('budget_request.project_status', 'in_progress');

        Storage::fake('public');
        $this->actingAs($tao)->post("/api/incidents/{$incident->id}/project", [
            '_method' => 'PATCH', 'project_status' => 'waiting_review',
            'progress_percent' => 90, 'evidence' => UploadedFile::fake()->image('progress.jpg'),
        ])->assertOk()->assertJsonPath('budget_request.project_status', 'waiting_review');
        $this->assertStringContainsString('/storage/project-evidence/', $incident->fresh()->budgetRequest->evidence_url);
    }

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
