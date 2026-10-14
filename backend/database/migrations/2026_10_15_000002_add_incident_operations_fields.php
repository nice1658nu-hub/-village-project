<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('incidents', function (Blueprint $table) {
            $table->timestamp('due_at')->nullable()->index()->after('priority');
            $table->string('department')->nullable()->after('assigned_to');
            $table->text('resolution_summary')->nullable()->after('resolved_image');
            $table->timestamp('citizen_confirmed_at')->nullable()->after('resolved_at');
            $table->timestamp('reopened_at')->nullable()->after('citizen_confirmed_at');
        });

        Schema::table('incident_feedback', function (Blueprint $table) {
            $table->boolean('resolution_confirmed')->nullable()->after('rating');
        });
    }

    public function down(): void
    {
        Schema::table('incident_feedback', function (Blueprint $table) {
            $table->dropColumn('resolution_confirmed');
        });
        Schema::table('incidents', function (Blueprint $table) {
            $table->dropIndex(['due_at']);
            $table->dropColumn(['due_at', 'department', 'resolution_summary', 'citizen_confirmed_at', 'reopened_at']);
        });
    }
};
