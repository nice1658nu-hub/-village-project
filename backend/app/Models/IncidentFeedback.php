<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IncidentFeedback extends Model
{
    protected $table = 'incident_feedback';
    protected $fillable = ['incident_id', 'user_id', 'rating', 'resolution_confirmed', 'comment'];
    protected function casts(): array { return ['rating' => 'integer', 'resolution_confirmed' => 'boolean']; }
    public function incident() { return $this->belongsTo(Incident::class); }
    public function user() { return $this->belongsTo(User::class); }
}
