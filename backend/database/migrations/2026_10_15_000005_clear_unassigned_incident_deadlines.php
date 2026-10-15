<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('incidents')
            ->where('requires_tao', false)
            ->where('status', 'pending')
            ->update(['due_at' => null]);
    }

    public function down(): void
    {
        // The former automatically generated deadline was not a real
        // commitment and therefore must not be recreated on rollback.
    }
};
