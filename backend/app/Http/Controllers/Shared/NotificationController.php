<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;

use App\Models\NotificationToken;
use App\Models\VillageNotification;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        return response()->json([
            'notifications' => VillageNotification::query()
                ->where(fn ($query) => $query->where('user_id', $request->user()->id)->orWhereNull('user_id'))
                ->when($request->user()->role === 'user', fn ($query) => $query->where('type', '!=', 'budget'))
                ->latest()
                ->limit(50)
                ->get(),
        ]);
    }

    public function saveToken(Request $request)
    {
        $data = $request->validate(['token' => ['required', 'string', 'max:4096'], 'provider' => ['nullable', 'in:firebase']]);
        $token = NotificationToken::updateOrCreate(
            ['user_id' => $request->user()->id, 'token' => $data['token']],
            ['provider' => $data['provider'] ?? 'firebase'],
        );
        return response()->json(['token' => $token], 201);
    }

    public function markAsRead(Request $request, VillageNotification $notification)
    {
        abort_unless($notification->user_id === null || $notification->user_id === $request->user()->id, 403);
        $notification->update(['read_at' => now()]);
        return response()->json($notification);
    }
}
