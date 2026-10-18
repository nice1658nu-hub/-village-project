<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('budget_requests');
        Schema::dropIfExists('budget_settings');
    }

    public function down(): void
    {
        // The removed budget subsystem is intentionally not recreated.
    }
};
