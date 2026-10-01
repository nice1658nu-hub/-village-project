<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class News extends Model
{
    use HasFactory;

    protected $table = 'news';
    protected $fillable = ['created_by', 'village_id', 'display_section', 'title', 'content', 'image', 'video_url', 'published_at'];
    protected function casts(): array { return ['published_at' => 'datetime']; }
    public function village() { return $this->belongsTo(Village::class); }
}
