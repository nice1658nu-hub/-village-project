<?php

use App\Models\Incident;
use App\Models\User;
use App\Models\VillageNotification;
use Illuminate\Contracts\Console\Kernel;

require dirname(__DIR__).'/vendor/autoload.php';
$app = require dirname(__DIR__).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$created = 0;
$admins = User::query()
    ->whereIn('role', ['village_admin', 'staff'])
    ->where('account_status', 'approved')
    ->get()
    ->groupBy('village_id');

User::query()->where('role', 'user')->where('account_status', 'pending')->each(function (User $user) use ($admins, &$created) {
    foreach ($admins->get($user->village_id, collect()) as $admin) {
        $exists = VillageNotification::query()->where('user_id', $admin->id)->where('type', 'user_registration')->where('data->user_id', $user->id)->exists();
        if (! $exists) {
            VillageNotification::create([
                'user_id' => $admin->id,
                'title' => 'มีคำขอสมัครสมาชิกใหม่',
                'description' => $user->name.' · บ้านเลขที่ '.$user->house_no,
                'type' => 'user_registration',
                'data' => ['user_id' => $user->id, 'village_id' => $user->village_id],
            ]);
            $created++;
        }
    }
});

Incident::query()->where('status', 'pending')->each(function (Incident $incident) use ($admins, &$created) {
    foreach ($admins->get($incident->village_id, collect()) as $admin) {
        $exists = VillageNotification::query()->where('user_id', $admin->id)->where('type', 'incident_created')->where('data->incident_id', $incident->id)->exists();
        if (! $exists) {
            VillageNotification::create([
                'user_id' => $admin->id,
                'title' => 'มีเรื่องร้องทุกข์ใหม่',
                'description' => $incident->title.' · '.$incident->location,
                'type' => 'incident_created',
                'data' => ['incident_id' => $incident->id, 'village_id' => $incident->village_id],
            ]);
            $created++;
        }
    }
});

echo "CREATED={$created}\n";
