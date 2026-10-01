<?php

namespace Tests\Feature;

use App\Models\Incident;
use App\Models\User;
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
        $resident = User::factory()->create();
        $staff = User::factory()->create(['role' => 'staff', 'house_no' => '-']);
        $incident = Incident::create([
            'user_id' => $resident->id, 'title' => 'ถนนชำรุด', 'category' => 'ถนน',
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
}
