<?php

namespace Tests\Feature;

use App\Models\Incident;
use App\Models\User;
use App\Models\Village;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class StaffWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_assigns_staff_and_work_requires_admin_review(): void
    {
        Storage::fake('public');
        $admin = User::factory()->admin()->create();
        $village = Village::firstOrFail();
        $resident = User::factory()->create(['village_id' => $village->id]);
        $staff = User::factory()->create(['role' => 'staff', 'village_id' => $village->id]);
        $incident = Incident::create([
            'user_id' => $resident->id, 'village_id' => $village->id,
            'requires_tao' => true, 'forwarded_to_tao_at' => now(),
            'title' => 'ถนนชำรุด', 'category' => 'ถนน',
            'description' => 'มีหลุมขนาดใหญ่', 'location' => 'หน้าหมู่บ้าน',
            'lat' => 17.1155, 'lng' => 100.2088, 'status' => 'pending',
        ]);
        $tinyPng = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=');

        $this->actingAs($admin)->patchJson("/api/incidents/{$incident->id}/assign", ['assigned_to' => $staff->id, 'priority' => 3])
            ->assertOk()->assertJsonPath('status', 'assigned')->assertJsonPath('assigned_to', $staff->id);

        $this->actingAs($staff)->patchJson("/api/incidents/{$incident->id}/start")
            ->assertOk()->assertJsonPath('status', 'in_progress');

        $this->actingAs($staff)->post("/api/incidents/{$incident->id}/progress", [
            'message' => 'ถึงพื้นที่และเริ่มซ่อมแล้ว', 'image' => UploadedFile::fake()->createWithContent('progress.png', $tinyPng),
        ])->assertCreated();

        $this->actingAs($staff)->post("/api/incidents/{$incident->id}/submit", [
            'message' => 'ซ่อมเสร็จแล้ว', 'resolvedImage' => UploadedFile::fake()->createWithContent('finished.png', $tinyPng),
        ])->assertOk()->assertJsonPath('status', 'waiting_review');

        $this->actingAs($admin)->patchJson("/api/incidents/{$incident->id}/review", ['decision' => 'approve'])
            ->assertOk()->assertJsonPath('status', 'resolved');

        $this->assertDatabaseHas('incidents', ['id' => $incident->id, 'assigned_to' => $staff->id, 'status' => 'resolved']);
        $this->assertDatabaseCount('incident_updates', 2);
    }

    public function test_staff_cannot_open_another_staff_members_job(): void
    {
        $resident = User::factory()->create();
        $assignedStaff = User::factory()->create(['role' => 'staff']);
        $otherStaff = User::factory()->create(['role' => 'staff']);
        $incident = Incident::create([
            'user_id' => $resident->id, 'assigned_to' => $assignedStaff->id,
            'title' => 'ไฟเสีย', 'category' => 'ไฟฟ้า', 'description' => 'ไฟดับ',
            'location' => 'ซอย 2', 'lat' => 17.1155, 'lng' => 100.2088, 'status' => 'assigned',
        ]);

        $this->actingAs($otherStaff)->patchJson("/api/incidents/{$incident->id}/start")->assertForbidden();
    }

    public function test_village_coordinator_can_cancel_a_local_incident_before_forwarding(): void
    {
        $village = Village::firstOrFail();
        $resident = User::factory()->create(['village_id' => $village->id]);
        $coordinator = User::factory()->create([
            'role' => 'village_admin',
            'village_id' => $village->id,
            'account_status' => 'approved',
        ]);
        $incident = Incident::create([
            'user_id' => $resident->id,
            'village_id' => $village->id,
            'requires_tao' => false,
            'title' => 'น้ำท่วม',
            'category' => 'อื่นๆ',
            'description' => 'ตรวจสอบแล้วไม่พบเหตุ',
            'location' => 'หมู่บ้าน',
            'lat' => 17.1155,
            'lng' => 100.2088,
            'status' => 'pending',
        ]);

        $this->actingAs($coordinator)
            ->patchJson("/api/incidents/{$incident->id}/cancel-by-village", ['note' => 'ยุติเรื่อง: ไม่พบเหตุจริง'])
            ->assertOk()
            ->assertJsonPath('status', 'cancelled');

        $this->assertDatabaseHas('incident_status_histories', [
            'incident_id' => $incident->id,
            'to_status' => 'cancelled',
        ]);
    }
}
