<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE users MODIFY role ENUM('admin','staff','user','village_admin','tao') NOT NULL DEFAULT 'user'");
        }

        $now = now();
        DB::table('users')->whereIn('phone', ['admin', 'staff'])->update(['account_status' => 'suspended', 'updated_at' => $now]);

        DB::table('users')->updateOrInsert(['phone' => 'tao'], [
            'name' => 'ศูนย์รับเรื่องร้องทุกข์ อบต.มะต้อง', 'email' => 'tao@matong.local',
            'house_no' => '-', 'village_id' => null, 'role' => 'tao', 'account_status' => 'approved',
            'approved_at' => $now, 'password' => Hash::make('Tao@2569'), 'created_at' => $now, 'updated_at' => $now,
        ]);

        foreach (DB::table('villages')->orderBy('moo')->get() as $village) {
            $moo = str_pad((string) $village->moo, 2, '0', STR_PAD_LEFT);
            DB::table('users')->updateOrInsert(['phone' => "village{$moo}"], [
                'name' => "แอดมินหมู่ {$village->moo} {$village->name}", 'email' => "village{$moo}@matong.local",
                'house_no' => '-', 'village_id' => $village->id, 'role' => 'village_admin', 'account_status' => 'approved',
                'approved_at' => $now, 'password' => Hash::make("Village{$moo}@2569"), 'created_at' => $now, 'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        DB::table('users')->where('role', 'village_admin')->delete();
        DB::table('users')->where('role', 'tao')->delete();
        DB::table('users')->whereIn('phone', ['admin', 'staff'])->update(['account_status' => 'approved']);
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE users MODIFY role ENUM('admin','staff','user') NOT NULL DEFAULT 'user'");
        }
    }
};
