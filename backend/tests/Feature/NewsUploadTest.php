<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class NewsUploadTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_create_news_with_a_real_image_upload(): void
    {
        Storage::fake('public');
        $admin = User::factory()->admin()->create();
        $tinyPng = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=');

        $response = $this->actingAs($admin)->post('/api/news', [
            'title' => 'ประกาศทดสอบ',
            'content' => 'รายละเอียดประกาศ',
            'image' => UploadedFile::fake()->createWithContent('announcement.png', $tinyPng),
        ]);

        $response->assertCreated()->assertJsonPath('news.title', 'ประกาศทดสอบ');
        $this->assertStringContainsString('/storage/news/', $response->json('news.image'));
    }
}
