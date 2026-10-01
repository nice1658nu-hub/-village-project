<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('villages', function (Blueprint $table) {
            $table->id();
            $table->unsignedTinyInteger('moo')->unique();
            $table->string('name');
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        $now = now();
        DB::table('villages')->insert([
            ['moo' => 1, 'name' => 'บ้านสนามไชย', 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['moo' => 2, 'name' => 'บ้านมะต้อง', 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['moo' => 3, 'name' => 'บ้านมะต้อง', 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['moo' => 4, 'name' => 'บ้านหางไหล', 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['moo' => 5, 'name' => 'บ้านไผ่ถ้ำ', 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['moo' => 6, 'name' => 'บ้านท้ายยาง', 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['moo' => 7, 'name' => 'บ้านท่าสำโรง', 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['moo' => 8, 'name' => 'บ้านป่าสัก', 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['moo' => 9, 'name' => 'บ้านสามศรีเจริญ', 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['moo' => 10, 'name' => 'บ้านปากคลองฉลอง', 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['moo' => 11, 'name' => 'บ้านคลองคล้า', 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['moo' => 12, 'name' => 'บ้านทศพล', 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
        ]);

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('village_id')->nullable()->after('house_no')->constrained()->nullOnDelete();
        });

        Schema::table('incidents', function (Blueprint $table) {
            $table->foreignId('village_id')->nullable()->after('user_id')->constrained()->nullOnDelete();
            $table->string('reference_no', 30)->nullable()->unique()->after('id');
            $table->boolean('requires_tao')->default(false)->index();
            $table->timestamp('forwarded_to_tao_at')->nullable();
            $table->foreignId('forwarded_by')->nullable()->constrained('users')->nullOnDelete();
        });

        $phaiThamId = DB::table('villages')->where('moo', 5)->value('id');
        DB::table('users')->whereNull('village_id')->whereIn('role', ['user', 'staff'])->update(['village_id' => $phaiThamId]);
        DB::table('incidents')->whereNull('village_id')->update(['village_id' => $phaiThamId]);

        Schema::create('budget_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('incident_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('requested_by')->constrained('users')->restrictOnDelete();
            $table->text('reason');
            $table->json('items')->nullable();
            $table->decimal('estimated_amount', 12, 2)->default(0);
            $table->decimal('approved_amount', 12, 2)->nullable();
            $table->decimal('actual_amount', 12, 2)->nullable();
            $table->enum('status', ['draft', 'submitted', 'approved', 'rejected', 'completed'])->default('draft')->index();
            $table->string('fiscal_year', 4)->nullable();
            $table->string('funding_source')->nullable();
            $table->string('document_reference')->nullable();
            $table->text('review_note')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action')->index();
            $table->string('subject_type');
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();
            $table->index(['subject_type', 'subject_id']);
        });

        Schema::create('incident_feedback', function (Blueprint $table) {
            $table->id();
            $table->foreignId('incident_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('rating');
            $table->text('comment')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('incident_feedback');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('budget_requests');
        Schema::table('incidents', function (Blueprint $table) {
            $table->dropConstrainedForeignId('village_id');
            $table->dropConstrainedForeignId('forwarded_by');
            $table->dropColumn(['reference_no', 'requires_tao', 'forwarded_to_tao_at']);
        });
        Schema::table('users', fn (Blueprint $table) => $table->dropConstrainedForeignId('village_id'));
        Schema::dropIfExists('villages');
    }
};
