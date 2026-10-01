<?php

namespace Tests\Feature;

use App\Models\News;
use App\Models\User;
use App\Models\Village;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NewsVisibilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_citizen_only_sees_news_from_own_village(): void
    {
        $villageFive = Village::create(['moo' => 105, 'name' => 'หมู่ทดสอบหนึ่ง', 'is_active' => true]);
        $villageSix = Village::create(['moo' => 106, 'name' => 'หมู่ทดสอบสอง', 'is_active' => true]);
        $citizen = User::factory()->create(['role' => 'user', 'village_id' => $villageFive->id]);

        News::create(['created_by' => $citizen->id, 'title' => 'ข่าวหมู่ 5', 'content' => 'สำหรับหมู่ 5', 'village_id' => $villageFive->id, 'published_at' => now()]);
        News::create(['created_by' => $citizen->id, 'title' => 'ข่าวหมู่ 6', 'content' => 'สำหรับหมู่ 6', 'village_id' => $villageSix->id, 'published_at' => now()]);
        News::create(['created_by' => $citizen->id, 'title' => 'ข่าว อบต.', 'content' => 'ข่าวส่วนกลาง', 'village_id' => null, 'published_at' => now()]);

        $response = $this->actingAs($citizen)->getJson('/api/dashboard/bootstrap');

        $response->assertOk()
            ->assertJsonCount(1, 'news')
            ->assertJsonPath('news.0.title', 'ข่าวหมู่ 5');
    }
}
