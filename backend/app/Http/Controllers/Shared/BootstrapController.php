<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use App\Models\Incident;
use App\Models\News;
use App\Models\User;
use App\Models\VillageNotification;
use App\Models\Village;
use Illuminate\Http\Request;

class BootstrapController extends Controller
{
    public function publicData()
    {
        return response()->json([
            'users' => [],
            'incidents' => [],
            'notifications' => [],
            'villages' => Village::where('is_active', true)->orderBy('moo')->get(),
            'news' => News::whereNotNull('published_at')->latest('published_at')->get(),
        ]);
    }

    public function authenticated(Request $request)
    {
        $user = $request->user();
        $incidents = Incident::with(['user.village', 'village', 'assignee.village', 'assigner', 'verifier', 'histories', 'updates.user', 'feedback'])
            ->withCount('supporters')
            // TAO receives a case only after the village has verified and
            // explicitly forwarded it. Unverified village cases are private
            // to that village and the reporting citizen.
            ->when($user->isTao(), fn ($q) => $q->where('requires_tao', true))
            ->when($user->isVillageAdmin(), fn ($q) => $q->where('village_id', $user->village_id))
            ->when(! $user->isTao() && ! $user->isVillageAdmin(), fn ($q) => $q
                ->where('village_id', $user->village_id)
                ->with('supporters:id'))
            ->latest()
            ->get();

        if ($user->role === 'user') {
            $incidents->each(function (Incident $incident) use ($user) {
                $incident->setAttribute('supported_by_me', $incident->supporters->contains('id', $user->id));
                $incident->setAttribute('is_own', (int) $incident->user_id === (int) $user->id);
                // Citizens may see the public incident, but never another reporter's identity.
                $incident->unsetRelation('user');
                $incident->unsetRelation('supporters');
            });
        }

        return response()->json([
            'users' => $user->isTao()
                ? User::with('village')->whereIn('role', ['user', 'village_admin'])->latest()->get()
                : ($user->isVillageAdmin() ? User::with('village')->where('role', 'user')->where('village_id', $user->village_id)->latest()->get() : []),
            'villages' => Village::where('is_active', true)->orderBy('moo')->get(),
            'news' => News::with('village')
                ->when($user->isVillageAdmin() || $user->role === 'user', fn ($q) => $q->where('village_id', $user->village_id))
                ->latest('published_at')->get(),
            'incidents' => $incidents,
            'notifications' => VillageNotification::where(fn ($q) => $q->where('user_id', $user->id)->orWhereNull('user_id'))
                ->latest()->get(),
        ]);
    }
}
