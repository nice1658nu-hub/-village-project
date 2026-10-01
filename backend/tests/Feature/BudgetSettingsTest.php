<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BudgetSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_save_shared_budget_settings(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->putJson('/api/budget-settings', [
            'reserve_percent' => 15,
            'unit_costs' => [
                'สาธารณูปโภค (ถนน/ท่อ)' => 22000,
                'ไฟฟ้า/แสงสว่าง' => 6500,
            ],
        ])->assertOk()
            ->assertJsonPath('reserve_percent', 15)
            ->assertJsonPath('unit_costs.สาธารณูปโภค (ถนน/ท่อ)', 22000);

        $this->assertDatabaseHas('budget_settings', [
            'category' => 'สาธารณูปโภค (ถนน/ท่อ)',
            'unit_cost' => 22000,
            'updated_by' => $admin->id,
        ]);
    }

    public function test_non_admin_cannot_change_budget_settings(): void
    {
        $resident = User::factory()->create();

        $this->actingAs($resident)->putJson('/api/budget-settings', [
            'reserve_percent' => 50,
            'unit_costs' => ['อื่นๆ' => 999999],
        ])->assertForbidden();
    }

    public function test_budget_settings_validation_rejects_unknown_categories(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->putJson('/api/budget-settings', [
            'reserve_percent' => 10,
            'unit_costs' => ['หมวดปลอม' => 1000],
        ])->assertUnprocessable();
    }
}
