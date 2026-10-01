<?php

namespace App\Http\Controllers\Tao;

use App\Http\Controllers\Controller;

use App\Models\BudgetSetting;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class BudgetSettingController extends Controller
{
    private const CATEGORIES = [
        'สาธารณูปโภค (ถนน/ท่อ)',
        'ไฟฟ้า/แสงสว่าง',
        'น้ำประปา',
        'ความสะอาด/ขยะ',
        'ความปลอดภัย/เสียงรบกวน',
        'อื่นๆ',
    ];

    public function update(Request $request)
    {
        $validated = $request->validate([
            'reserve_percent' => ['required', 'integer', 'min:0', 'max:50'],
            'unit_costs' => ['required', 'array'],
            'unit_costs.*' => ['required', 'integer', 'min:0', 'max:100000000'],
        ]);

        foreach ($validated['unit_costs'] as $category => $unitCost) {
            validator(['category' => $category], [
                'category' => ['required', Rule::in(self::CATEGORIES)],
            ])->validate();

            BudgetSetting::updateOrCreate(
                ['category' => $category],
                ['unit_cost' => $unitCost, 'reserve_percent' => $validated['reserve_percent'], 'updated_by' => $request->user()->id],
            );
        }

        return response()->json($this->payload());
    }

    public static function payload(): array
    {
        return [
            'unit_costs' => BudgetSetting::pluck('unit_cost', 'category'),
            'reserve_percent' => (int) (BudgetSetting::value('reserve_percent') ?? 10),
        ];
    }
}
