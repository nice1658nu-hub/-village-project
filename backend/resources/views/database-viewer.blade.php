<!doctype html>
<html lang="th">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ฐานข้อมูล {{ $database }} — SmartVillage</title>
    <style>
        *{box-sizing:border-box} body{margin:0;background:#f4f7fb;color:#172033;font-family:"Leelawadee UI","Noto Sans Thai",Tahoma,sans-serif;line-height:1.5}
        header{background:linear-gradient(135deg,#172554,#1d4ed8);color:#fff;padding:24px clamp(16px,4vw,48px)} header h1{margin:0;font-size:clamp(24px,4vw,38px)} header p{margin:6px 0 0;color:#dbeafe}
        main{display:grid;grid-template-columns:280px minmax(0,1fr);gap:20px;max-width:1600px;margin:auto;padding:20px}
        aside,.panel{background:#fff;border:1px solid #dfe7f1;border-radius:18px;box-shadow:0 8px 30px rgba(15,23,42,.06)} aside{padding:14px;height:calc(100dvh - 140px);overflow:auto;position:sticky;top:16px}
        .summary{padding:12px;margin-bottom:10px;border-radius:12px;background:#eff6ff;color:#1e40af;font-weight:700}.table-link{display:flex;justify-content:space-between;gap:8px;padding:10px 12px;margin:3px 0;border-radius:10px;color:#334155;text-decoration:none}.table-link:hover,.table-link.active{background:#2563eb;color:#fff}.table-link small{opacity:.7;white-space:nowrap}
        .panel{min-width:0;overflow:hidden}.panel-head{padding:18px 20px;border-bottom:1px solid #e5e7eb}.panel-head h2{margin:0}.panel-head p{margin:4px 0 0;color:#64748b}.empty{padding:64px 24px;text-align:center;color:#64748b}
        .schema{display:flex;gap:8px;overflow:auto;padding:14px 18px;border-bottom:1px solid #e5e7eb}.column{min-width:max-content;border:1px solid #dbe3ef;border-radius:10px;padding:8px 10px;font-size:13px}.column b{display:block;color:#1d4ed8}.column span{color:#64748b}
        .data{overflow:auto;max-height:calc(100dvh - 300px)}table{width:100%;border-collapse:collapse;font-size:13px;white-space:nowrap}th,td{border-bottom:1px solid #e5e7eb;padding:10px 12px;text-align:left;max-width:360px;overflow:hidden;text-overflow:ellipsis}th{position:sticky;top:0;background:#0f172a;color:#fff;z-index:1}tbody tr:nth-child(even){background:#f8fafc}tbody tr:hover{background:#eff6ff}.badge{display:inline-block;background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:999px;font-size:12px}
        @media(max-width:800px){main{grid-template-columns:1fr;padding:12px}aside{position:static;height:auto;max-height:260px}.data{max-height:none}header{padding:18px 16px}}
    </style>
</head>
<body>
<header>
    <h1>ตัวดูฐานข้อมูล SmartVillage</h1>
    <p>ฐานข้อมูล <strong>{{ $database }}</strong> · อ่านอย่างเดียว · ข้อมูลรหัสผ่านและโทเคนถูกซ่อน</p>
</header>
<main>
    <aside>
        <div class="summary">{{ $tables->count() }} ตารางในระบบ</div>
        @foreach ($tables as $table)
            <a class="table-link {{ $selected === $table->name ? 'active' : '' }}" href="{{ route('database.viewer', ['table' => $table->name]) }}">
                <span>{{ $table->name }}</span><small>{{ number_format((int) $table->row_count) }} แถว</small>
            </a>
        @endforeach
    </aside>
    <section class="panel">
        @if ($selected === '')
            <div class="empty"><h2>เลือกตารางทางด้านซ้าย</h2><p>เพื่อดูโครงสร้างคอลัมน์และข้อมูลตัวอย่างสูงสุด 50 แถว</p></div>
        @else
            <div class="panel-head"><h2>{{ $selected }}</h2><p><span class="badge">{{ $columns->count() }} คอลัมน์</span> แสดงข้อมูลสูงสุด 50 แถว</p></div>
            <div class="schema">
                @foreach ($columns as $column)
                    <div class="column"><b>{{ $column->name }}</b><span>{{ $column->type }}{{ $column->nullable === 'YES' ? ' · NULL' : '' }}{{ $column->column_key ? ' · '.$column->column_key : '' }}</span></div>
                @endforeach
            </div>
            <div class="data">
                @if ($rows->isEmpty())
                    <div class="empty">ตารางนี้ยังไม่มีข้อมูล</div>
                @else
                    <table><thead><tr>@foreach(array_keys($rows->first()) as $key)<th>{{ $key }}</th>@endforeach</tr></thead>
                    <tbody>@foreach($rows as $row)<tr>@foreach($row as $value)<td title="{{ is_scalar($value) ? $value : '' }}">{{ is_null($value) ? 'NULL' : (is_scalar($value) ? $value : json_encode($value, JSON_UNESCAPED_UNICODE)) }}</td>@endforeach</tr>@endforeach</tbody></table>
                @endif
            </div>
        @endif
    </section>
</main>
</body>
</html>
