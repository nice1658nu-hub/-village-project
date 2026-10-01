<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('budget_requests', function (Blueprint $table) {
            $table->string('project_title')->nullable()->after('requested_by');
            $table->unsignedInteger('affected_people')->nullable()->after('reason');
            $table->enum('urgency', ['normal', 'urgent', 'critical'])->default('normal')->after('affected_people');
            $table->enum('project_status', ['proposed', 'approved', 'planned', 'in_progress', 'waiting_review', 'completed'])->default('proposed')->index()->after('status');
            $table->string('executor')->nullable()->after('review_note');
            $table->date('start_date')->nullable()->after('executor');
            $table->date('expected_end_date')->nullable()->after('start_date');
            $table->unsignedTinyInteger('progress_percent')->default(0)->after('expected_end_date');
            $table->text('project_note')->nullable()->after('progress_percent');
            $table->string('evidence_url')->nullable()->after('project_note');
        });
    }

    public function down(): void
    {
        Schema::table('budget_requests', function (Blueprint $table) {
            $table->dropIndex(['project_status']);
            $table->dropColumn([
                'project_title', 'affected_people', 'urgency', 'project_status',
                'executor', 'start_date', 'expected_end_date', 'progress_percent',
                'project_note', 'evidence_url',
            ]);
        });
    }
};
