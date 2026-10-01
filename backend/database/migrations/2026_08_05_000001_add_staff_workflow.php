<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE users MODIFY role ENUM('admin','staff','user') NOT NULL DEFAULT 'user'");
            DB::statement("ALTER TABLE incidents MODIFY status ENUM('pending','assigned','in_progress','waiting_review','revision_requested','resolved','cancelled') NOT NULL DEFAULT 'pending'");
        }

        Schema::table('incidents', function (Blueprint $table) {
            if (! Schema::hasColumn('incidents', 'assigned_to')) {
                $table->foreignId('assigned_to')->nullable()->after('user_id')->constrained('users')->nullOnDelete();
                $table->foreignId('assigned_by')->nullable()->after('assigned_to')->constrained('users')->nullOnDelete();
                $table->timestamp('assigned_at')->nullable()->after('assigned_by');
                $table->timestamp('submitted_for_review_at')->nullable()->after('resolved_at');
                $table->foreignId('verified_by')->nullable()->after('submitted_for_review_at')->constrained('users')->nullOnDelete();
                $table->timestamp('verified_at')->nullable()->after('verified_by');
            }
        });

        if (! Schema::hasTable('incident_updates')) {
            Schema::create('incident_updates', function (Blueprint $table) {
                $table->id();
                $table->foreignId('incident_id')->constrained()->cascadeOnDelete();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->text('message')->nullable();
                $table->string('image')->nullable();
                $table->string('type')->default('progress');
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('incident_updates');
        Schema::table('incidents', function (Blueprint $table) {
            $table->dropConstrainedForeignId('assigned_to');
            $table->dropConstrainedForeignId('assigned_by');
            $table->dropConstrainedForeignId('verified_by');
            $table->dropColumn(['assigned_at', 'submitted_for_review_at', 'verified_at']);
        });
    }
};
