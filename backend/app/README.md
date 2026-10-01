# Backend Application

- `Http/Controllers/Tao/` — งานของฝ่าย อบต.และงบประมาณ
- `Http/Controllers/Village/` — งานของผู้ดูแลหมู่บ้านและประชาชนในหมู่บ้าน
- `Http/Controllers/Cases/` — เรื่องร้องทุกข์ที่ประชาชนสร้าง
- `Http/Controllers/Shared/` — เข้าสู่ระบบ ข่าว การแจ้งเตือน และข้อมูลตั้งต้น
- `Http/Middleware/` — ตรวจบทบาทผู้ใช้งานก่อนเข้า API
- `Models/` — ความสัมพันธ์และฟิลด์ของตารางฐานข้อมูล
- `Services/` — งานเชื่อมต่อบริการภายนอก เช่น Firebase

รายการ URL ของ API อยู่ที่ `backend/routes/api.php`
