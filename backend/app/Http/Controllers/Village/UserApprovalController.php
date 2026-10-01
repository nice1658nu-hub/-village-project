<?php

namespace App\Http\Controllers\Village;

use App\Http\Controllers\Controller;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserApprovalController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()->isTao() || $request->user()->isVillageAdmin(), 403);
        return User::where('role', 'user')
            ->when($request->user()->isVillageAdmin(), fn ($q) => $q->where('village_id', $request->user()->village_id))
            ->when($request->status, fn ($q, $status) => $q->where('account_status', $status))->latest()->paginate(30);
    }

    public function update(Request $request, User $user)
    {
        abort_unless($request->user()->isTao() || ($request->user()->isVillageAdmin() && $request->user()->village_id === $user->village_id && $user->role === 'user'), 403);
        $data = $request->validate([
            'account_status' => ['required', Rule::in(['pending', 'approved', 'rejected', 'suspended'])],
            'approval_note' => ['nullable', 'string', 'max:1000'],
        ]);
        $user->update([
            ...$data,
            'approved_by' => $request->user()->id,
            'approved_at' => $data['account_status'] === 'approved' ? now() : null,
        ]);
        if ($data['account_status'] !== 'approved') $user->tokens()->delete();
        return response()->json(['user' => $user->fresh()]);
    }

    public function resetPassword(Request $request, User $user)
    {
        abort_if($user->isTao() || $user->isVillageAdmin(), 403, 'Administrator passwords cannot be reset here.');
        abort_unless($request->user()->isTao() || ($request->user()->isVillageAdmin() && $request->user()->village_id === $user->village_id), 403);

        $data = $request->validate([
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user->update(['password' => Hash::make($data['password'])]);
        $user->tokens()->delete();

        return response()->json([
            'message' => 'Password reset successfully.',
            'user' => $user->fresh(),
        ]);
    }
}
