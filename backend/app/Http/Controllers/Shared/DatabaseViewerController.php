<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DatabaseViewerController extends Controller
{
    public function index(Request $request)
    {
        abort_unless(app()->environment('local'), 404);

        $database = DB::getDatabaseName();
        $tables = collect(DB::select(
            'SELECT TABLE_NAME AS name, TABLE_ROWS AS row_count, ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024, 1) AS size_kb
             FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = ?
             ORDER BY TABLE_NAME',
            [$database]
        ));

        $selected = (string) $request->query('table', '');
        $allowedTables = $tables->pluck('name')->all();
        if ($selected !== '' && ! in_array($selected, $allowedTables, true)) {
            abort(404);
        }

        $columns = collect();
        $rows = collect();
        if ($selected !== '') {
            $columns = collect(DB::select(
                'SELECT COLUMN_NAME AS name, COLUMN_TYPE AS type, IS_NULLABLE AS nullable, COLUMN_KEY AS column_key
                 FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
                 ORDER BY ORDINAL_POSITION',
                [$database, $selected]
            ));

            $rows = DB::table($selected)->limit(50)->get()->map(function ($row) {
                return collect((array) $row)->mapWithKeys(function ($value, $key) {
                    $sensitive = preg_match('/password|token|secret|remember/i', (string) $key);

                    return [$key => $sensitive && $value !== null ? '•••••••• (ซ่อน)' : $value];
                })->all();
            });
        }

        return view('database-viewer', compact('database', 'tables', 'selected', 'columns', 'rows'));
    }
}
