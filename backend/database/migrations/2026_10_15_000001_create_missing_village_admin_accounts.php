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

        foreach (DB::table('villages')->orderBy('moo')->get() as $village) {
            $moo = (string) $village->moo;
            $phone = "moo{$moo}";
            $email = "village{$moo}@matong.local";

            $account = DB::table('users')
                ->where('village_id', $village->id)
                ->whereIn('role', ['village_admin', 'staff'])
                ->first()
                ?? DB::table('users')->where('phone', $phone)->first()
                ?? DB::table('users')->where('email', $email)->first();

            $values = [
                'name' => "แอดมินหมู่ {$village->moo} {$village->name}",
                'phone' => $phone,
                'email' => $email,
                'house_no' => '-',
                'village_id' => $village->id,
                'role' => 'village_admin',
                'account_status' => 'approved',
                'approved_at' => $now,
                'password' => Hash::make("moo{$moo}@69"),
                'updated_at' => $now,
            ];

            if ($account) {
                DB::table('users')->where('id', $account->id)->update($values);
            } else {
                DB::table('users')->insert([...$values, 'created_at' => $now]);
            }
        }
    }

    public function down(): void
    {
        DB::table('users')
            ->where('role', 'village_admin')
            ->where('phone', 'like', 'moo%')
            ->delete();
    }
};
