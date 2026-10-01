<?php

namespace Tests\Feature;

use App\Models\Incident;
use App\Models\User;
use App\Models\Village;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class IncidentFeedbackTest extends TestCase
{
    use RefreshDatabase;

    public function test_resident_can_rate_only_their_resolved_incident(): void
    {
        $village = Village::firstOrFail();
        $resident = User::factory()->create(['village_id' => $village->id]);
        $other = User::factory()->create(['village_id' => $village->id]);
        $incident = Incident::create([
            'user_id' => $resident->id, 'village_id' => $village->id,
            'title' => 'ถนนชำรุด', 'category' => 'ถนน', 'description' => 'ชำรุด',
            'location' => 'หน้าบ้าน', 'lat' => 17.1, 'lng' => 100.1,
            'status' => 'resolved', 'resolved_at' => now(),
        ]);

        $this->actingAs($resident)->putJson("/api/incidents/{$incident->id}/feedback", [
            'rating' => 5, 'comment' => 'แก้ไขเรียบร้อย',
        ])->assertOk()->assertJsonPath('feedback.rating', 5);

        $this->actingAs($other)->putJson("/api/incidents/{$incident->id}/feedback", [
            'rating' => 1,
        ])->assertForbidden();
    }
}
