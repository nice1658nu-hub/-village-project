<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BudgetRequest extends Model
{
    protected $fillable = ['incident_id', 'requested_by', 'project_title', 'reason', 'affected_people', 'urgency', 'items', 'estimated_amount', 'approved_amount', 'actual_amount', 'status', 'project_status', 'fiscal_year', 'funding_source', 'document_reference', 'review_note', 'executor', 'start_date', 'expected_end_date', 'progress_percent', 'project_note', 'evidence_url', 'reviewed_by', 'submitted_at', 'reviewed_at'];
    protected function casts(): array { return ['items' => 'array', 'affected_people' => 'integer', 'estimated_amount' => 'decimal:2', 'approved_amount' => 'decimal:2', 'actual_amount' => 'decimal:2', 'start_date' => 'date', 'expected_end_date' => 'date', 'progress_percent' => 'integer', 'submitted_at' => 'datetime', 'reviewed_at' => 'datetime']; }
    public function incident() { return $this->belongsTo(Incident::class); }
    public function requester() { return $this->belongsTo(User::class, 'requested_by'); }
    public function reviewer() { return $this->belongsTo(User::class, 'reviewed_by'); }
}
