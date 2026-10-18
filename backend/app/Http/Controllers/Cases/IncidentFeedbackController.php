<?php

namespace App\Http\Controllers\Cases;

use App\Http\Controllers\Controller;
use App\Models\Incident;
use App\Models\IncidentFeedback;
use App\Models\IncidentStatusHistory;
use App\Models\User;
use App\Models\VillageNotification;
use Illuminate\Http\Request;

class IncidentFeedbackController extends Controller
{
    public function store(Request $request, Incident $incident)
    {
        abort_unless($incident->user_id === $request->user()->id, 403);
        abort_unless($incident->status === 'resolved', 409, 'Feedback is available after the incident is resolved.');

        $data = $request->validate([
            'decision' => ['required', 'in:confirm,reopen'],
            'rating' => ['nullable', 'required_if:decision,confirm', 'integer', 'between:1,5'],
            'comment' => ['nullable', 'string', 'max:1000'],
        ]);
        if ($data['decision'] === 'reopen' && empty(trim($data['comment'] ?? ''))) {
            abort(422, 'กรุณาระบุว่ายังมีปัญหาส่วนใด');
        }

        $feedback = IncidentFeedback::updateOrCreate(
            ['incident_id' => $incident->id, 'user_id' => $request->user()->id],
            ['rating' => $data['rating'] ?? null, 'comment' => $data['comment'] ?? null, 'resolution_confirmed' => $data['decision'] === 'confirm'],
        );

        if ($data['decision'] === 'confirm') {
            $incident->update(['citizen_confirmed_at' => now()]);
        } else {
            $incident->update(['status' => 'in_progress', 'resolved_at' => null, 'citizen_confirmed_at' => null, 'reopened_at' => now()]);
            IncidentStatusHistory::create(['incident_id' => $incident->id, 'changed_by' => $request->user()->id, 'from_status' => 'resolved', 'to_status' => 'in_progress', 'note' => 'ประชาชนแจ้งว่ายังแก้ไขไม่เรียบร้อย: '.$data['comment']]);
            User::query()->where('account_status', 'approved')->where(fn ($query) => $query->where('id', $incident->assigned_to)->orWhere(fn ($sub) => $sub->whereIn('role', ['village_admin', 'staff'])->where('village_id', $incident->village_id)))->pluck('id')->unique()->each(fn ($userId) => VillageNotification::create(['user_id' => $userId, 'title' => 'ประชาชนขอเปิดเรื่องอีกครั้ง', 'description' => $incident->title.' · '.$data['comment'], 'type' => 'incident_status', 'data' => ['incident_id' => $incident->id, 'status' => 'in_progress']]));
        }

        return response()->json(['feedback' => $feedback, 'incident' => $incident->fresh(['user.village', 'village', 'assignee.village', 'assigner', 'verifier', 'histories', 'updates.user', 'feedback'])]);
    }
}
