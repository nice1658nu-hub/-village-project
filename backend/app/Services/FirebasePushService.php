<?php

namespace App\Services;

use App\Models\NotificationToken;
use App\Models\VillageNotification;
use Illuminate\Support\Facades\Log;
use Kreait\Firebase\Factory;
use Kreait\Firebase\Messaging\CloudMessage;
use Kreait\Firebase\Messaging\Notification;
use Throwable;

class FirebasePushService
{
    public function send(VillageNotification $notification): void
    {
        $credentials = config('services.firebase.credentials');
        if (! $credentials || ! is_file($credentials) || ! $notification->user_id) return;

        $tokens = NotificationToken::where('user_id', $notification->user_id)
            ->where('provider', 'firebase')->pluck('token');
        if ($tokens->isEmpty()) return;

        try {
            $messaging = (new Factory)->withServiceAccount($credentials)->createMessaging();
            $data = collect($notification->data ?? [])->map(fn ($value) => is_scalar($value) ? (string) $value : json_encode($value))->all();

            foreach ($tokens as $token) {
                $message = CloudMessage::withTarget('token', $token)
                    ->withNotification(Notification::create($notification->title, $notification->description))
                    ->withData($data + ['notification_id' => (string) $notification->id, 'type' => $notification->type]);
                $messaging->send($message);
            }
        } catch (Throwable $error) {
            Log::warning('Firebase push notification failed.', [
                'notification_id' => $notification->id,
                'message' => $error->getMessage(),
            ]);
        }
    }
}
