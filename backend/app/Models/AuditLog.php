<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    protected $fillable = ['user_id', 'action', 'subject_type', 'subject_id', 'old_values', 'new_values', 'ip_address'];
    protected function casts(): array { return ['old_values' => 'array', 'new_values' => 'array']; }
    public function user() { return $this->belongsTo(User::class); }
}
