<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Village;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $villages = [
            1 => 'บ้านสนามไชย', 2 => 'บ้านมะต้อง', 3 => 'บ้านมะต้อง', 4 => 'บ้านหางไหล',
            5 => 'บ้านไผ่ถ้ำ', 6 => 'บ้านท้ายยาง', 7 => 'บ้านท่าสำโรง', 8 => 'บ้านป่าสัก',
            9 => 'บ้านสามศรีเจริญ', 10 => 'บ้านปากคลองฉลอง', 11 => 'บ้านคลองคล้า', 12 => 'บ้านทศพล',
        ];
        foreach ($villages as $moo => $name) {
            Village::updateOrCreate(['moo' => $moo], ['name' => $name, 'is_active' => true]);
        }

        User::updateOrCreate(['phone' => 'admin'], [
            'name' => 'เจ้าหน้าที่ อบต.มะต้อง',
            'house_no' => '-',
            'email' => 'admin@smartvillage.local',
            'role' => 'admin',
            'account_status' => 'approved',
            'approved_at' => now(),
            'password' => 'Admin@69',
        ]);

        // Preserve any records linked to the original demo staff account by
        // promoting it to the permanent Village05 account before upserting all
        // village administrators.
        $legacyStaff = User::where('phone', 'staff')->first();
        if ($legacyStaff && ! User::where('phone', 'Village05')->exists()) {
            $legacyStaff->phone = 'Village05';
            $legacyStaff->save();
        } elseif ($legacyStaff) {
            $legacyStaff->phone = 'legacy-staff-'.$legacyStaff->id;
            $legacyStaff->account_status = 'rejected';
            $legacyStaff->password = bin2hex(random_bytes(24));
            $legacyStaff->save();
        }

        foreach (array_keys($villages) as $moo) {
            $number = str_pad((string) $moo, 2, '0', STR_PAD_LEFT);

            User::updateOrCreate(['phone' => 'Village'.$number], [
                'name' => 'ผู้ประสานงานหมู่ '.$moo,
                'house_no' => '-',
                'email' => 'village'.$number.'@smartvillage.local',
                'role' => 'staff',
                'village_id' => Village::where('moo', $moo)->value('id'),
                'account_status' => 'approved',
                'approved_at' => now(),
                'password' => 'Moo'.$number.'@69',
            ]);
        }
    }
}
