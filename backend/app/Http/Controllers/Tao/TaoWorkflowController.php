<?php

namespace App\Http\Controllers\Tao;

use App\Http\Controllers\Controller;

use App\Models\AuditLog;
use App\Models\Incident;
use App\Models\IncidentUpdate;
use App\Models\User;
use App\Models\VillageNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class TaoWorkflowController extends Controller
{
    public function forward(Request $request, Incident $incident)
    {
        $user = $request->user();
        abort_unless($user->isVillageAdmin() && $user->village_id === $incident->village_id, 403, 'Only this village administrator can forward the incident to TAO.');
        abort_if(in_array($incident->status, ['resolved', 'cancelled'], true), 409, 'Closed incidents cannot be forwarded.');
        abort_if($incident->requires_tao, 409, 'This incident has already been forwarded to TAO.');

        $data = $request->validate([
            'note' => ['required', 'string', 'max:2000'],
            'inspection_image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:10240'],
        ]);
        $inspectionImage = null;
        if ($request->hasFile('inspection_image')) {
            $path = $request->file('inspection_image')->store('incident-inspections', 'public');
            $inspectionImage = Storage::disk('public')->url($path);
        }
        $old = $incident->only(['requires_tao', 'forwarded_to_tao_at', 'forwarded_by']);
        $incident->update(['requires_tao' => true, 'forwarded_to_tao_at' => now(), 'forwarded_by' => $user->id]);
        IncidentUpdate::create([
            'incident_id' => $incident->id,
            'user_id' => $user->id,
            'message' => $data['note'],
            'image' => $inspectionImage,
            'type' => 'village_verification',
        ]);
        $this->audit($request, 'incident.forwarded_to_tao', $incident, $old, $incident->only(array_keys($old)));

        $incident->supporters()->pluck('users.id')->push($incident->user_id)->unique()->each(fn ($userId) => VillageNotification::create(['user_id' => $userId, 'title' => 'ส่งเรื่องให้ อบต.มะต้องแล้ว', 'description' => $data['note'] ?? $incident->title, 'type' => 'incident_status', 'data' => ['incident_id' => $incident->id]]));
        User::query()
            ->whereIn('role', ['tao', 'admin'])
            ->where('account_status', 'approved')
            ->where('id', '!=', $user->id)
            ->pluck('id')
            ->each(fn ($taoId) => VillageNotification::create([
                'user_id' => $taoId,
                'title' => 'มีเรื่องร้องทุกข์ส่งเข้า อบต. ใหม่',
                'description' => 'หมู่ '.($incident->village?->moo ?? '-').' · '.$incident->title.' · '.$incident->location,
                'type' => 'incident_forwarded',
                'data' => ['incident_id' => $incident->id, 'village_id' => $incident->village_id],
            ]));
        return response()->json($this->load($incident));
    }

    private function audit(Request $request, string $action, $subject, ?array $old, ?array $new): void
    {
        AuditLog::create(['user_id' => $request->user()->id, 'action' => $action, 'subject_type' => $subject::class, 'subject_id' => $subject->id, 'old_values' => $old, 'new_values' => $new, 'ip_address' => $request->ip()]);
    }

    private function load(Incident $incident): Incident
    {
        return $incident->fresh(['user.village', 'village', 'assignee.village', 'assigner', 'verifier', 'histories', 'updates.user', 'feedback']);
    }
}
