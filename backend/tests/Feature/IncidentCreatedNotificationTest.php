<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Village;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class IncidentCreatedNotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_new_incident_notifies_only_the_admin_of_that_village(): void
    {
        $village = Village::where('moo', 5)->firstOrFail();
        $otherVillage = Village::where('moo', 6)->firstOrFail();
        $admin = User::factory()->create(['role' => 'village_admin', 'village_id' => $village->id]);
        $otherAdmin = User::factory()->create(['role' => 'village_admin', 'village_id' => $otherVillage->id]);
        $resident = User::factory()->create(['role' => 'user', 'village_id' => $village->id]);

        $this->actingAs($resident)->postJson('/api/incidents', [
            'title' => 'ถนนชำรุด',
            'category' => 'สาธารณูปโภค (ถนน/ท่อ)',
            'description' => 'ถนนมีหลุมขนาดใหญ่',
            'location' => 'หน้าโรงเรียน',
            'lat' => 17.07948,
            'lng' => 100.1799,
        ])->assertCreated();

        $this->assertDatabaseHas('village_notifications', [
            'user_id' => $admin->id, 'type' => 'incident_created', 'title' => 'มีเรื่องร้องทุกข์ใหม่',
        ]);
        $this->assertDatabaseMissing('village_notifications', [
            'user_id' => $otherAdmin->id, 'type' => 'incident_created',
        ]);
    }
}
