<?php

namespace App\Http\Controllers\Cases;

use App\Http\Controllers\Controller;

use App\Models\Incident;
use App\Models\IncidentStatusHistory;
use App\Models\IncidentUpdate;
use App\Models\User;
use App\Models\VillageNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class IncidentController extends Controller
{
    public function store(Request $request)
    {
        $data = $this->validateIncident($request);
        $duplicate = $request->user()->incidents()
            ->where('created_at', '>=', now()->subMinutes(2))
            ->where('title', $data['title'])
            ->where('category', $data['category'])
            ->where('description', $data['description'])
            ->where('location', $data['location'])
            ->latest()
            ->first();

        // A slow mobile connection can submit the same form more than once.
        // Return the existing record instead of creating duplicate incidents.
        if ($duplicate) {
            return response()->json([
                'incident' => $duplicate->load(['user.village', 'village']),
                'duplicate_prevented' => true,
            ]);
        }

        if ($request->hasFile('image')) {
            $path = $request->file('image')->store('incidents', 'public');
            $data['image'] = Storage::disk('public')->url($path);
        }
        // A completion deadline is an operational commitment made by TAO
        // after accepting and assigning the forwarded case. A newly reported
        // case has not reached that step yet, so it must not get an arbitrary
        // seven-day deadline.
        $incident = $request->user()->incidents()->create($data + ['status' => 'pending', 'priority' => 1, 'due_at' => null, 'village_id' => $request->user()->village_id]);
        $incident->update(['reference_no' => sprintf('MT-%s-%02d-%04d', now()->addYears(543)->format('Y'), $incident->village?->moo ?? 0, $incident->id)]);
        IncidentStatusHistory::create(['incident_id' => $incident->id, 'changed_by' => $request->user()->id, 'to_status' => 'pending', 'note' => 'Incident created']);
        User::query()
            ->whereIn('role', ['village_admin', 'staff'])
            ->where('account_status', 'approved')
            ->where('village_id', $incident->village_id)
            ->pluck('id')
            ->each(fn ($adminId) => VillageNotification::create([
                'user_id' => $adminId,
                'title' => 'มีเรื่องร้องทุกข์ใหม่',
                'description' => $incident->title.' · '.$incident->location,
                'type' => 'incident_created',
                'data' => ['incident_id' => $incident->id, 'village_id' => $incident->village_id],
            ]));
        return response()->json(['incident' => $incident->load(['user.village', 'village'])], 201);
    }

    public function update(Request $request, Incident $incident)
    {
        $this->ownerCanChange($request, $incident);
        abort_unless($incident->status === 'pending', 409, 'Only pending incidents can be edited.');
        $data = $this->validateIncident($request);
        if ($request->hasFile('image')) {
            $path = $request->file('image')->store('incidents', 'public');
            $data['image'] = Storage::disk('public')->url($path);
        }
        $incident->update($data);
        return response()->json($incident);
    }

    public function support(Request $request, Incident $incident)
    {
        $user = $request->user();
        abort_unless($user->role === 'user', 403, 'Only citizens can follow village incidents.');
        abort_unless((int) $user->village_id === (int) $incident->village_id, 403, 'This incident is outside your village.');
        abort_if($incident->status === 'cancelled', 409, 'Cancelled incidents cannot be followed.');

        if ((int) $incident->user_id !== (int) $user->id) {
            $syncResult = $incident->supporters()->syncWithoutDetaching([$user->id]);

            if (count($syncResult['attached'] ?? []) > 0) {
                User::query()
                    ->whereIn('role', ['village_admin', 'staff'])
                    ->where('account_status', 'approved')
                    ->where('village_id', $incident->village_id)
                    ->pluck('id')
                    ->each(fn ($adminId) => VillageNotification::create([
                        'user_id' => $adminId,
                        'title' => 'มีประชาชนพบเหตุเดียวกันเพิ่ม',
                        'description' => $incident->title.' · ผู้พบปัญหารวม '.($incident->supporters()->count() + 1).' คน',
                        'type' => 'incident_support',
                        'data' => ['incident_id' => $incident->id, 'village_id' => $incident->village_id],
                    ]));
            }
        }

        return response()->json([
            'incident_id' => $incident->id,
            'supporter_count' => $incident->supporters()->count(),
            'supported_by_me' => (int) $incident->user_id !== (int) $user->id,
        ]);
    }

    public function updateStatus(Request $request, Incident $incident)
    {
        $user = $request->user();
        abort_unless($user->isTao(), 403, 'Only TAO officers can manage a forwarded incident.');
        abort_unless($incident->requires_tao, 403, 'This incident has not been forwarded by the village.');
        $data = $request->validate([
            'status' => ['required', Rule::in(['pending', 'in_progress', 'resolved', 'cancelled'])],
            'note' => ['nullable', 'string', 'max:2000'],
            'department' => ['nullable', 'string', 'max:255'],
            'due_at' => ['nullable', 'date'],
            'action' => ['nullable', Rule::in(['request_info', 'merge_duplicate'])],
            'resolvedImage' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:10240'],
        ]);
        $resolvedImage = $incident->resolved_image;
        if ($request->hasFile('resolvedImage')) {
            $path = $request->file('resolvedImage')->store('incident-resolutions', 'public');
            $resolvedImage = Storage::disk('public')->url($path);
        }
        $from = $incident->status;
        $incident->update([
            'status' => $data['status'], 'resolved_image' => $resolvedImage,
            'department' => $data['department'] ?? $incident->department,
            'due_at' => $data['due_at'] ?? $incident->due_at,
            'resolution_summary' => $data['status'] === 'resolved' ? ($data['note'] ?? $incident->resolution_summary) : $incident->resolution_summary,
            'first_response_at' => $from === 'pending' && $data['status'] === 'in_progress' ? now() : $incident->first_response_at,
            'resolved_at' => $data['status'] === 'resolved' ? now() : null,
        ]);
        IncidentStatusHistory::create(['incident_id' => $incident->id, 'changed_by' => $request->user()->id, 'from_status' => $from, 'to_status' => $data['status'], 'note' => $data['note'] ?? null]);
        $notificationTitles = [
            'pending' => 'รับเรื่องแล้ว',
            'in_progress' => 'กำลังดำเนินการ',
            'resolved' => 'แก้ไขเสร็จแล้ว',
            'cancelled' => 'ยุติเรื่องแล้ว',
        ];
        if (($data['action'] ?? null) === 'request_info') {
            IncidentUpdate::create([
                'incident_id' => $incident->id,
                'user_id' => $user->id,
                'message' => $data['note'] ?? null,
                'type' => 'info_request',
            ]);
            $notificationTitles[$data['status']] = 'เจ้าหน้าที่ขอข้อมูลเพิ่มเติม';
        } elseif (($data['action'] ?? null) === 'merge_duplicate') {
            $notificationTitles[$data['status']] = 'รวมเรื่องนี้กับเรื่องเดิมแล้ว';
        }
        if (($data['action'] ?? null) === 'request_info') {
            User::query()
                ->where('account_status', 'approved')
                ->where('village_id', $incident->village_id)
                ->whereIn('role', ['village_admin', 'staff'])
                ->pluck('id')
                ->unique()
                ->each(fn ($userId) => VillageNotification::create([
                    'user_id' => $userId,
                    'title' => 'อบต.ขอข้อมูลเพิ่มเติม',
                    'description' => $incident->title.(! empty($data['note']) ? ' · '.$data['note'] : ''),
                    'type' => 'incident_status',
                    'data' => ['incident_id' => $incident->id, 'status' => $data['status'], 'action' => 'request_info'],
                ]));
        } else {
            $incident->supporters()->pluck('users.id')->push($incident->user_id)->unique()->each(fn ($userId) => VillageNotification::create([
                'user_id' => $userId,
                'title' => $notificationTitles[$data['status']],
                'description' => $incident->title.(! empty($data['note']) ? ' · '.$data['note'] : ''),
                'type' => 'incident_status',
                'data' => ['incident_id' => $incident->id, 'status' => $data['status']],
            ]));
        }
        return response()->json($incident->fresh([
            'user.village', 'village', 'assignee.village', 'assigner', 'verifier',
            'histories', 'updates.user', 'budgetRequest.requester',
            'budgetRequest.reviewer', 'feedback',
        ]));
    }

    public function destroy(Request $request, Incident $incident)
    {
        if (! $request->user()->isAdmin()) {
            $this->ownerCanChange($request, $incident);
            abort_unless($incident->status === 'pending', 409, 'Only pending incidents can be deleted.');
        }
        $incident->delete();
        return response()->noContent();
    }

    private function ownerCanChange(Request $request, Incident $incident): void
    {
        abort_unless($request->user()->isAdmin() || ($request->user()->isVillageCoordinator() && $request->user()->village_id === $incident->village_id) || $incident->user_id === $request->user()->id, 403);
    }

    private function validateIncident(Request $request): array
    {
        return $request->validate([
            'title' => ['required', 'string', 'max:255'], 'category' => ['required', 'string', 'max:100'],
            'description' => ['required', 'string', 'max:5000'], 'location' => ['required', 'string', 'max:255'],
            'lat' => ['required', 'numeric', 'between:-90,90'], 'lng' => ['required', 'numeric', 'between:-180,180'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:10240'],
        ]);
    }
}
