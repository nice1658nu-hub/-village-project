<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('news', function (Blueprint $table) {
            $table->string('display_section', 20)->default('news')->after('village_id')->index();
        });

        DB::table('news')->whereNotNull('video_url')->where('video_url', '!=', '')->update(['display_section' => 'video']);
    }

    public function down(): void
    {
        Schema::table('news', fn (Blueprint $table) => $table->dropColumn('display_section'));
    }
};
