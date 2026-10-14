<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

return new class extends Migration
{
    public function up(): void
    {
        foreach (DB::table('villages')->orderBy('moo')->get() as $village) {
            $account = DB::table('users')
                ->where('role', 'village_admin')
                ->where('village_id', $village->id)
                ->first();

            if (! $account) {
                continue;
            }

            $moo = (string) $village->moo;
            DB::table('users')->where('id', $account->id)->update([
                'phone' => "moo{$moo}",
                'password' => Hash::make("moo{$moo}@69"),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        foreach (DB::table('villages')->orderBy('moo')->get() as $village) {
            $account = DB::table('users')
                ->where('role', 'village_admin')
                ->where('village_id', $village->id)
                ->first();

            if (! $account) {
                continue;
            }

            $moo = str_pad((string) $village->moo, 2, '0', STR_PAD_LEFT);
            DB::table('users')->where('id', $account->id)->update([
                'phone' => "village{$moo}",
                'password' => Hash::make("Village{$moo}@2569"),
                'updated_at' => now(),
            ]);
        }
    }
};
