# การสำรองฐานข้อมูล Smart Village

ก่อนสาธิตระบบหรือแก้ฐานข้อมูล ให้คลิกขวาไฟล์ `scripts/backup-database.ps1` แล้วเลือก **Run with PowerShell** หรือรันคำสั่ง:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup-database.ps1
```

ระบบจะสำรอง 2 ส่วนไว้ใน `backend/storage/backups`:

- `smart_village_วันเวลา.sql` — ตารางและข้อมูล MySQL ทั้งหมด
- `uploads_วันเวลา.tar.gz` — รูปแจ้งเหตุ ข่าว และหลักฐานโครงการ

การกู้คืนจะเขียนทับข้อมูล จึงไม่ทำอัตโนมัติ ควรสำรองฐานปัจจุบันและตรวจชื่อไฟล์ก่อนทุกครั้ง

