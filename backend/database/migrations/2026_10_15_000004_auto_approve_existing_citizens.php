<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')
            ->where('role', 'user')
            ->whereIn('account_status', ['pending', 'rejected'])
            ->update([
                'account_status' => 'approved',
                'approved_at' => now(),
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        // Account activation is intentionally not reverted.
    }
};
