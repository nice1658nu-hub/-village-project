<?php

namespace App\Models;

use App\Services\FirebasePushService;
use Illuminate\Database\Eloquent\Model;

class VillageNotification extends Model
{
    protected $fillable = ['user_id', 'title', 'description', 'type', 'data', 'read_at'];
    protected function casts(): array { return ['data' => 'array', 'read_at' => 'datetime']; }

    protected static function booted(): void
    {
        static::created(fn (VillageNotification $notification) => app(FirebasePushService::class)->send($notification));
    }
}
