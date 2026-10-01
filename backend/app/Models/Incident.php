<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Incident extends Model
{
    use HasFactory;

    protected $fillable = ['reference_no', 'user_id', 'village_id', 'assigned_to', 'assigned_by', 'assigned_at', 'title', 'category', 'description', 'location', 'lat', 'lng', 'image', 'resolved_image', 'status', 'priority', 'first_response_at', 'resolved_at', 'submitted_for_review_at', 'verified_by', 'verified_at', 'requires_tao', 'forwarded_to_tao_at', 'forwarded_by'];
    protected function casts(): array { return ['lat' => 'decimal:7', 'lng' => 'decimal:7', 'requires_tao' => 'boolean', 'assigned_at' => 'datetime', 'first_response_at' => 'datetime', 'resolved_at' => 'datetime', 'submitted_for_review_at' => 'datetime', 'verified_at' => 'datetime', 'forwarded_to_tao_at' => 'datetime']; }
    public function user() { return $this->belongsTo(User::class); }
    public function histories() { return $this->hasMany(IncidentStatusHistory::class); }
    public function assignee() { return $this->belongsTo(User::class, 'assigned_to'); }
    public function assigner() { return $this->belongsTo(User::class, 'assigned_by'); }
    public function verifier() { return $this->belongsTo(User::class, 'verified_by'); }
    public function updates() { return $this->hasMany(IncidentUpdate::class); }
    public function village() { return $this->belongsTo(Village::class); }
    public function budgetRequest() { return $this->hasOne(BudgetRequest::class); }
    public function feedback() { return $this->hasOne(IncidentFeedback::class); }
    public function forwarder() { return $this->belongsTo(User::class, 'forwarded_by'); }
}
