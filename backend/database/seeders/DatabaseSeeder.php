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
            'password' => 'admin1234',
        ]);
        User::updateOrCreate(['phone' => 'staff'], [
            'name' => 'ผู้ประสานงานบ้านไผ่ถ้ำ',
            'house_no' => '-',
            'email' => 'staff@smartvillage.local',
            'role' => 'staff',
            'village_id' => Village::where('moo', 5)->value('id'),
            'account_status' => 'approved',
            'approved_at' => now(),
            'password' => 'staff1234',
        ]);
    }
}
