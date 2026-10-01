<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BudgetSetting extends Model
{
    protected $fillable = ['category', 'unit_cost', 'reserve_percent', 'updated_by'];

    protected function casts(): array
    {
        return ['unit_cost' => 'integer', 'reserve_percent' => 'integer'];
    }
}
