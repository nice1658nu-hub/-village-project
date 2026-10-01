<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Tao\BudgetSettingController;

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
        return response()->json([
            'users' => $user->isTao()
                ? User::with('village')->whereIn('role', ['user', 'village_admin'])->latest()->get()
                : ($user->isVillageAdmin() ? User::with('village')->where('role', 'user')->where('village_id', $user->village_id)->latest()->get() : []),
            'villages' => Village::where('is_active', true)->orderBy('moo')->get(),
            'news' => News::with('village')
                ->when($user->isVillageAdmin() || $user->role === 'user', fn ($q) => $q->where('village_id', $user->village_id))
                ->latest('published_at')->get(),
            'incidents' => Incident::with(['user.village', 'village', 'assignee.village', 'assigner', 'verifier', 'histories', 'updates.user', 'budgetRequest.requester', 'budgetRequest.reviewer', 'feedback'])
                ->when($user->isVillageAdmin(), fn ($q) => $q->where('village_id', $user->village_id))
                ->when(! $user->isTao() && ! $user->isVillageAdmin(), fn ($q) => $q->where('user_id', $user->id))
                ->latest()->get(),
            'notifications' => VillageNotification::where(fn ($q) => $q->where('user_id', $user->id)->orWhereNull('user_id'))
                ->when($user->role === 'user', fn ($q) => $q->where('type', '!=', 'budget'))
                ->latest()->get(),
            'budgetSettings' => $user->isTao() ? BudgetSettingController::payload() : null,
        ]);
    }
}
