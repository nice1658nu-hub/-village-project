<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('news', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('content');
            $table->string('image')->nullable();
            $table->date('published_at')->nullable();
            $table->timestamps();
        });

        Schema::create('incidents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->string('category');
            $table->text('description');
            $table->string('location');
            $table->decimal('lat', 10, 7)->nullable();
            $table->decimal('lng', 10, 7)->nullable();
            $table->string('image')->nullable();
            $table->enum('status', ['pending', 'in_progress', 'resolved'])->default('pending');
            $table->timestamp('first_response_at')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->string('resolved_image')->nullable();
            $table->timestamps();
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title');
            $table->text('description');
            $table->boolean('is_read')->default(false);
            $table->timestamps();
        });

        Schema::create('notification_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('provider')->default('firebase');
            $table->text('token');
            $table->timestamps();
            $table->unique(['user_id', 'token']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_tokens');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('incidents');
        Schema::dropIfExists('news');
    }
};
