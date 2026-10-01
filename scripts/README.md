# Scripts

- `start-smart-village.ps1` — เปิด MySQL, Laravel และ React
- `start-backend.sh` — เปิด Laravel ภายใน WSL
- `check-smart-village.ps1` — รันชุดทดสอบและ build
- `setup-gmail.ps1` — ตั้งค่า Gmail สำหรับกู้รหัสผ่าน

ผู้ใช้งานทั่วไปไม่ต้องเปิดไฟล์ในโฟลเดอร์นี้ ให้ใช้ไฟล์ `.cmd` ที่รากโครงการแทน
# สำรองข้อมูล

รัน `backup-database.ps1` เพื่อสำรองฐาน `smart_village` พร้อมรูปและไฟล์แนบ รายละเอียดอยู่ที่ `docs/DATABASE-BACKUP.md`

# เปิด phpMyAdmin

รัน `open-phpmyadmin.ps1` เพื่อเปิด phpMyAdmin ผ่าน `http://127.0.0.1:8081/phpmyadmin/` โดยสคริปต์จะค้นหา IP ของ WSL ให้โดยอัตโนมัติ
