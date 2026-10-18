<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('users', 'house_no')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('house_no');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasColumn('users', 'house_no')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('house_no', 50)->nullable()->after('email');
            });
        }
    }
};
