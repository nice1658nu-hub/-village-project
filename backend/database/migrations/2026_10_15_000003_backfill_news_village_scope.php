<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Older village news was created before news.village_id existed and
        // therefore looked like TAO public content. Recover its scope from the
        // creator account; real TAO accounts have no village_id and stay null.
        DB::table('news')
            ->join('users', 'users.id', '=', 'news.created_by')
            ->whereNull('news.village_id')
            ->whereNotNull('users.village_id')
            ->select('news.id', 'users.village_id')
            ->orderBy('news.id')
            ->get()
            ->each(fn ($news) => DB::table('news')
                ->where('id', $news->id)
                ->update(['village_id' => $news->village_id]));
    }

    public function down(): void
    {
        // Data repair is intentionally not reversed.
    }
};
