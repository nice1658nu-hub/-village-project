<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IncidentUpdate extends Model
{
    protected $fillable = ['incident_id', 'user_id', 'message', 'image', 'type'];

    public function incident() { return $this->belongsTo(Incident::class); }
    public function user() { return $this->belongsTo(User::class); }
}
