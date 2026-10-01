<?php

namespace App\Http\Controllers\Village;

use App\Http\Controllers\Controller;

use App\Models\Incident;
use App\Models\IncidentStatusHistory;
use App\Models\IncidentUpdate;
use App\Models\User;
use App\Models\VillageNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class StaffWorkflowController extends Controller
{
    public function createStaff(Request $request)
    {
        abort_unless($request->user()->isTao(), 403);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:20', 'unique:users,phone'],
            'email' => ['required', 'email:rfc', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'village_id' => ['required', 'integer', 'exists:villages,id'],
        ]);
        $staff = User::create($data + [
            'house_no' => '-', 'role' => 'village_admin', 'village_id' => $data['village_id'], 'account_status' => 'approved',
            'approved_by' => $request->user()->id, 'approved_at' => now(),
        ]);
        return response()->json(['user' => $staff], 201);
    }

    public function assign(Request $request, Incident $incident)
    {
        abort_unless($request->user()->isTao(), 403);
        $data = $request->validate([
            'assigned_to' => ['required', Rule::exists('users', 'id')->where(fn ($q) => $q->whereIn('role', ['staff', 'village_admin'])->where('account_status', 'approved')->where('village_id', $incident->village_id))],
            'priority' => ['nullable', 'integer', 'between:1,4'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);
        abort_if(in_array($incident->status, ['resolved', 'cancelled'], true), 409, 'Closed incidents cannot be assigned.');
        $from = $incident->status;
        $incident->update([
            'assigned_to' => $data['assigned_to'], 'assigned_by' => $request->user()->id,
            'assigned_at' => now(), 'priority' => $data['priority'] ?? $incident->priority,
            'status' => 'assigned',
        ]);
        $this->history($incident, $request->user()->id, $from, 'assigned', $data['note'] ?? 'มอบหมายงานให้เจ้าหน้าที่');
        VillageNotification::create(['user_id' => $data['assigned_to'], 'title' => 'คุณได้รับมอบหมายงานใหม่', 'description' => $incident->title, 'type' => 'assignment', 'data' => ['incident_id' => $incident->id]]);
        VillageNotification::create(['user_id' => $incident->user_id, 'title' => 'เรื่องของคุณได้รับมอบหมายแล้ว', 'description' => $incident->title, 'type' => 'incident_status', 'data' => ['incident_id' => $incident->id]]);
        return response()->json($this->load($incident));
    }

    public function start(Request $request, Incident $incident)
    {
        $this->assignedStaffOnly($request, $incident);
        abort_unless(in_array($incident->status, ['pending', 'assigned', 'revision_requested'], true), 409, 'This incident cannot be started.');
        $from = $incident->status;
        $incident->update(['status' => 'in_progress', 'assigned_to' => $incident->assigned_to ?? $request->user()->id, 'assigned_by' => $incident->assigned_by ?? $request->user()->id, 'assigned_at' => $incident->assigned_at ?? now(), 'first_response_at' => $incident->first_response_at ?? now()]);
        $this->history($incident, $request->user()->id, $from, 'in_progress', 'ผู้ดูแลหมู่บ้านเริ่มดำเนินการ');
        $this->notifyResident($incident, 'กำลังดำเนินการ', 'ผู้ดูแลหมู่บ้านเริ่มแก้ไขเรื่องของคุณแล้ว', 'in_progress');
        return response()->json($this->load($incident));
    }

    public function progress(Request $request, Incident $incident)
    {
        $this->assignedStaffOnly($request, $incident);
        abort_unless(in_array($incident->status, ['in_progress', 'revision_requested'], true), 409, 'Progress cannot be added in the current status.');
        $data = $request->validate([
            'message' => ['nullable', 'string', 'max:3000'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:10240'],
        ]);
        abort_if(empty($data['message']) && ! $request->hasFile('image'), 422, 'A message or image is required.');
        $image = null;
        if ($request->hasFile('image')) {
            $path = $request->file('image')->store('incident-progress', 'public');
            $image = Storage::disk('public')->url($path);
        }
        $update = IncidentUpdate::create(['incident_id' => $incident->id, 'user_id' => $request->user()->id, 'message' => $data['message'] ?? null, 'image' => $image, 'type' => 'progress']);
        return response()->json(['update' => $update->load('user'), 'incident' => $this->load($incident)], 201);
    }

    public function submit(Request $request, Incident $incident)
    {
        $this->assignedStaffOnly($request, $incident);
        abort_unless(in_array($incident->status, ['in_progress', 'revision_requested'], true), 409, 'This incident cannot be submitted.');
        $data = $request->validate([
            'message' => ['nullable', 'string', 'max:3000'],
            'resolvedImage' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:10240'],
        ]);
        $path = $request->file('resolvedImage')->store('incident-resolutions', 'public');
        $image = Storage::disk('public')->url($path);
        IncidentUpdate::create(['incident_id' => $incident->id, 'user_id' => $request->user()->id, 'message' => $data['message'] ?? 'ส่งงานให้ผู้ดูแลตรวจรับ', 'image' => $image, 'type' => 'completion']);
        $from = $incident->status;
        $incident->update(['status' => 'waiting_review', 'resolved_image' => $image, 'submitted_for_review_at' => now()]);
        $this->history($incident, $request->user()->id, $from, 'waiting_review', $data['message'] ?? 'ส่งงานให้ตรวจรับ');
        $this->notifyAdmins('มีงานรอตรวจรับ', $incident);
        return response()->json($this->load($incident));
    }

    public function review(Request $request, Incident $incident)
    {
        abort_unless($request->user()->isTao(), 403);
        abort_unless($incident->status === 'waiting_review', 409, 'Only submitted work can be reviewed.');
        $data = $request->validate(['decision' => ['required', Rule::in(['approve', 'revision'])], 'note' => ['nullable', 'string', 'max:2000']]);
        if ($data['decision'] === 'revision') {
            abort_if(empty($data['note']), 422, 'A revision note is required.');
        }
        $to = $data['decision'] === 'approve' ? 'resolved' : 'revision_requested';
        $incident->update([
            'status' => $to, 'verified_by' => $request->user()->id, 'verified_at' => now(),
            'resolved_at' => $to === 'resolved' ? now() : null,
        ]);
        $this->history($incident, $request->user()->id, 'waiting_review', $to, $data['note'] ?? 'ตรวจรับและปิดงาน');
        $this->notifyResident(
            $incident,
            $to === 'resolved' ? 'แก้ไขเสร็จแล้ว' : 'กำลังแก้ไขเพิ่มเติม',
            $to === 'resolved' ? 'ผู้ดูแลตรวจรับและปิดเรื่องแล้ว' : 'งานถูกส่งกลับให้แก้ไขเพิ่มเติม',
            $to,
        );
        if ($to === 'revision_requested') {
            VillageNotification::create(['user_id' => $incident->assigned_to, 'title' => 'งานถูกส่งกลับให้แก้ไข', 'description' => $data['note'], 'type' => 'revision', 'data' => ['incident_id' => $incident->id]]);
        }
        return response()->json($this->load($incident));
    }

    private function assignedStaffOnly(Request $request, Incident $incident): void
    {
        abort_unless($request->user()->isVillageCoordinator() && $request->user()->village_id === $incident->village_id && ($incident->assigned_to === null || $incident->assigned_to === $request->user()->id), 403);
    }

    private function history(Incident $incident, int $userId, ?string $from, string $to, ?string $note): void
    {
        IncidentStatusHistory::create(['incident_id' => $incident->id, 'changed_by' => $userId, 'from_status' => $from, 'to_status' => $to, 'note' => $note]);
    }

    private function notifyResident(Incident $incident, string $title, string $description, string $status): void
    {
        VillageNotification::create([
            'user_id' => $incident->user_id,
            'title' => $title,
            'description' => $incident->title.' · '.$description,
            'type' => 'incident_status',
            'data' => ['incident_id' => $incident->id, 'status' => $status],
        ]);
    }

    private function notifyAdmins(string $title, Incident $incident): void
    {
        User::where('role', 'admin')->where('account_status', 'approved')->pluck('id')->each(fn ($id) => VillageNotification::create(['user_id' => $id, 'title' => $title, 'description' => $incident->title, 'type' => 'review', 'data' => ['incident_id' => $incident->id]]));
    }

    private function load(Incident $incident): Incident
    {
        return $incident->fresh(['user.village', 'village', 'assignee.village', 'assigner', 'verifier', 'histories', 'updates.user', 'budgetRequest', 'feedback']);
    }
}
