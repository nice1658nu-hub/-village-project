<?php

namespace App\Http\Controllers\Tao;

use App\Http\Controllers\Controller;

use App\Models\AuditLog;
use App\Models\BudgetRequest;
use App\Models\Incident;
use App\Models\VillageNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class TaoWorkflowController extends Controller
{
    public function forward(Request $request, Incident $incident)
    {
        $user = $request->user();
        abort_unless($user->isTao() || ($user->isVillageAdmin() && $user->village_id === $incident->village_id), 403);
        abort_if(in_array($incident->status, ['resolved', 'cancelled'], true), 409, 'Closed incidents cannot be forwarded.');

        $data = $request->validate(['note' => ['nullable', 'string', 'max:2000']]);
        $old = $incident->only(['requires_tao', 'forwarded_to_tao_at', 'forwarded_by']);
        $incident->update(['requires_tao' => true, 'forwarded_to_tao_at' => now(), 'forwarded_by' => $user->id]);
        $this->audit($request, 'incident.forwarded_to_tao', $incident, $old, $incident->only(array_keys($old)));

        VillageNotification::create(['user_id' => $incident->user_id, 'title' => 'ส่งเรื่องให้ อบต.มะต้องแล้ว', 'description' => $data['note'] ?? $incident->title, 'type' => 'incident_status', 'data' => ['incident_id' => $incident->id]]);
        return response()->json($this->load($incident));
    }

    public function saveBudget(Request $request, Incident $incident)
    {
        $user = $request->user();
        abort_unless($user->isTao() || ($user->isVillageAdmin() && $user->village_id === $incident->village_id), 403);
        $data = $request->validate([
            'project_title' => ['required', 'string', 'max:255'],
            'reason' => ['required', 'string', 'max:3000'],
            'affected_people' => ['required', 'integer', 'min:1', 'max:1000000'],
            'urgency' => ['required', Rule::in(['normal', 'urgent', 'critical'])],
            'items' => ['nullable', 'array', 'max:50'],
            'items.*.description' => ['required_with:items', 'string', 'max:255'],
            'items.*.quantity' => ['required_with:items', 'numeric', 'min:0'],
            'items.*.unit_price' => ['required_with:items', 'numeric', 'min:0'],
            'estimated_amount' => ['required', 'numeric', 'min:0', 'max:9999999999.99'],
            'submit' => ['nullable', 'boolean'],
        ]);

        $existing = $incident->budgetRequest;
        abort_if($existing && in_array($existing->status, ['approved', 'completed'], true) && ! $user->isTao(), 409, 'Approved budget cannot be changed.');
        abort_if($existing && $existing->status === 'submitted' && ! $user->isTao(), 409, 'คำขอถูกส่งให้ อบต.แล้ว ไม่สามารถแก้ไขระหว่างรอพิจารณา');
        $old = $existing?->toArray();
        $budget = BudgetRequest::updateOrCreate(['incident_id' => $incident->id], [
            'requested_by' => $existing?->requested_by ?? $user->id,
            'project_title' => $data['project_title'],
            'reason' => $data['reason'], 'items' => $data['items'] ?? [],
            'affected_people' => $data['affected_people'],
            'urgency' => $data['urgency'],
            'estimated_amount' => $data['estimated_amount'],
            'status' => ($data['submit'] ?? false) ? 'submitted' : ($existing?->status ?? 'draft'),
            'submitted_at' => ($data['submit'] ?? false) ? now() : $existing?->submitted_at,
        ]);
        if ($data['submit'] ?? false) {
            $incident->update(['requires_tao' => true, 'forwarded_to_tao_at' => $incident->forwarded_to_tao_at ?? now(), 'forwarded_by' => $incident->forwarded_by ?? $user->id]);
        }
        $this->audit($request, 'budget.saved', $budget, $old, $budget->fresh()->toArray());
        return response()->json($this->load($incident));
    }

    public function reviewBudget(Request $request, Incident $incident)
    {
        abort_unless($request->user()->isTao(), 403);
        $budget = $incident->budgetRequest;
        abort_unless($budget && $budget->status === 'submitted', 409, 'Only submitted budgets can be reviewed.');
        $data = $request->validate([
            'decision' => ['required', Rule::in(['approve', 'reject'])],
            'approved_amount' => ['required_if:decision,approve', 'nullable', 'numeric', 'min:0', 'max:9999999999.99'],
            'fiscal_year' => ['nullable', 'string', 'size:4'], 'funding_source' => ['nullable', 'string', 'max:255'],
            'document_reference' => ['nullable', 'string', 'max:255'], 'review_note' => ['nullable', 'string', 'max:3000'],
        ]);
        $old = $budget->toArray();
        $budget->update([
            'status' => $data['decision'] === 'approve' ? 'approved' : 'rejected',
            'project_status' => $data['decision'] === 'approve' ? 'approved' : 'proposed',
            'approved_amount' => $data['decision'] === 'approve' ? $data['approved_amount'] : null,
            'fiscal_year' => $data['fiscal_year'] ?? null, 'funding_source' => $data['funding_source'] ?? null,
            'document_reference' => $data['document_reference'] ?? null, 'review_note' => $data['review_note'] ?? null,
            'reviewed_by' => $request->user()->id, 'reviewed_at' => now(),
        ]);
        $this->audit($request, 'budget.reviewed', $budget, $old, $budget->fresh()->toArray());
        // Budget review is an internal workflow between TAO and the village
        // coordinator. The resident who reported the incident only receives
        // normal incident-status updates, not accounting notifications.
        VillageNotification::create([
            'user_id' => $budget->requested_by,
            'title' => $data['decision'] === 'approve' ? 'งบประมาณได้รับอนุมัติ' : 'คำของบประมาณยังไม่ผ่าน',
            'description' => $data['review_note'] ?? $incident->title,
            'type' => 'budget',
            'data' => ['incident_id' => $incident->id],
        ]);
        return response()->json($this->load($incident));
    }

    public function updateProject(Request $request, Incident $incident)
    {
        abort_unless($request->user()->isTao(), 403);
        $budget = $incident->budgetRequest;
        abort_unless($budget && in_array($budget->status, ['approved', 'completed'], true), 409, 'Project budget must be approved first.');

        $data = $request->validate([
            'project_status' => ['required', Rule::in(['approved', 'planned', 'in_progress', 'waiting_review', 'completed'])],
            'executor' => ['nullable', 'string', 'max:255'],
            'start_date' => ['nullable', 'date'],
            'expected_end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'progress_percent' => ['required', 'integer', 'between:0,100'],
            'actual_amount' => ['nullable', 'numeric', 'min:0', 'max:9999999999.99'],
            'project_note' => ['nullable', 'string', 'max:3000'],
            'evidence_url' => ['nullable', 'url', 'max:2048'],
            'evidence' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
        ]);

        if ($request->hasFile('evidence')) {
            $path = $request->file('evidence')->store('project-evidence', 'public');
            $data['evidence_url'] = Storage::disk('public')->url($path);
        }
        unset($data['evidence']);

        if ($data['project_status'] === 'completed') {
            abort_if((int) $data['progress_percent'] !== 100, 422, 'Completed projects must have 100% progress.');
            abort_if(($data['actual_amount'] ?? null) === null, 422, 'กรุณาระบุค่าใช้จ่ายจริงก่อนปิดโครงการ');
            abort_if((float) ($data['actual_amount'] ?? 0) > (float) $budget->approved_amount, 422, 'ค่าใช้จ่ายจริงเกินวงเงินอนุมัติ กรุณาขออนุมัติเพิ่มก่อน');
            abort_if(empty($data['evidence_url'] ?? null), 422, 'กรุณาแนบใบเสร็จหรือหลักฐานก่อนปิดโครงการ');
        }

        $old = $budget->toArray();
        $budget->update($data + [
            'status' => $data['project_status'] === 'completed' ? 'completed' : 'approved',
        ]);
        $this->audit($request, 'project.updated', $budget, $old, $budget->fresh()->toArray());

        VillageNotification::create([
            'user_id' => $budget->requested_by,
            'title' => $data['project_status'] === 'completed' ? 'โครงการดำเนินการเสร็จแล้ว' : 'ความคืบหน้าโครงการอัปเดตแล้ว',
            'description' => $budget->project_title ?: $incident->title,
            'type' => 'project',
            'data' => ['incident_id' => $incident->id, 'project_status' => $data['project_status']],
        ]);

        return response()->json($this->load($incident));
    }

    public function recordActual(Request $request, Incident $incident)
    {
        $user = $request->user();
        abort_unless($user->isTao() || ($user->isVillageAdmin() && $user->village_id === $incident->village_id), 403);
        $budget = $incident->budgetRequest;
        abort_unless($budget && $budget->status === 'approved', 409, 'Budget must be approved first.');
        $data = $request->validate([
            'actual_amount' => ['required', 'numeric', 'min:0', 'max:9999999999.99'],
            'document_reference' => ['nullable', 'string', 'max:255'],
            'evidence' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
        ]);
        abort_if((float) $data['actual_amount'] > (float) $budget->approved_amount, 422, 'ค่าใช้จ่ายจริงเกินวงเงินอนุมัติ กรุณาติดต่อ อบต.');
        if ($request->hasFile('evidence')) {
            $path = $request->file('evidence')->store('project-evidence', 'public');
            $data['evidence_url'] = Storage::disk('public')->url($path);
        }
        abort_if(empty($data['document_reference'] ?? null) && empty($data['evidence_url'] ?? null) && empty($budget->evidence_url), 422, 'กรุณาแนบหลักฐานหรือระบุเลขที่เอกสาร');
        $old = $budget->toArray();
        $budget->update([
            'actual_amount' => $data['actual_amount'],
            'document_reference' => $data['document_reference'] ?? $budget->document_reference,
            'evidence_url' => $data['evidence_url'] ?? $budget->evidence_url,
        ]);
        $this->audit($request, 'budget.actual_recorded', $budget, $old, $budget->fresh()->toArray());
        return response()->json($this->load($incident));
    }

    private function audit(Request $request, string $action, $subject, ?array $old, ?array $new): void
    {
        AuditLog::create(['user_id' => $request->user()->id, 'action' => $action, 'subject_type' => $subject::class, 'subject_id' => $subject->id, 'old_values' => $old, 'new_values' => $new, 'ip_address' => $request->ip()]);
    }

    private function load(Incident $incident): Incident
    {
        return $incident->fresh(['user.village', 'village', 'assignee.village', 'assigner', 'verifier', 'histories', 'updates.user', 'budgetRequest.requester', 'budgetRequest.reviewer', 'feedback']);
    }
}
