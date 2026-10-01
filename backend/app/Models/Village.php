<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Village extends Model
{
    protected $fillable = ['moo', 'name', 'is_active'];
    protected function casts(): array { return ['is_active' => 'boolean']; }
    public function users() { return $this->hasMany(User::class); }
    public function incidents() { return $this->hasMany(Incident::class); }
}
