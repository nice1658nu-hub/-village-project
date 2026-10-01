# แผนที่ไฟล์โครงการ SmartVillage

เอกสารนี้ใช้ตอบคำถามว่า “ต้องแก้ไฟล์ไหน” โดยเริ่มจากตารางด้านล่าง

## งานที่ต้องการทำ → ตำแหน่งไฟล์

| งาน | ตำแหน่ง |
|---|---|
| แก้หน้าจอหรือการทำงาน React | `src/app/SmartVillageApp.jsx` |
| แก้สี ฟอนต์ ระยะห่าง และ CSS กลาง | `src/styles/index.css` |
| แก้ชื่อระบบ ชื่อหมู่บ้าน หรือหมวดเหตุ | `src/config/app.js` |
| แก้ URL หรือคำสั่งเรียก Backend | `src/services/api.js` |
| แก้การแจ้งเตือน Firebase | `src/services/firebaseNotifications.js` |
| แก้สูตรคำนวณ/วิเคราะห์ข้อมูล | `src/utils/village.js` และส่วน `AdminAnalytics` ใน `src/app/SmartVillageApp.jsx` |
| แก้ข้อมูลตัวอย่างตอน Backend ไม่ทำงาน | `src/data/mockData.js` |
| แก้เส้นทาง API | `backend/routes/api.php` |
| แก้ตรรกะของ API | `backend/app/Http/Controllers/` |
| แก้โครงสร้างข้อมูล | `backend/app/Models/` และ `backend/database/migrations/` |
| แก้บัญชีเริ่มต้น/ข้อมูลเริ่มต้น | `backend/database/seeders/DatabaseSeeder.php` |
| เปิดระบบ | ดับเบิลคลิก `START-SMART-VILLAGE.cmd` |
| ตรวจระบบ | ดับเบิลคลิก `CHECK-SMART-VILLAGE.cmd` |

## โครงสร้างที่ควรเห็น

```text
SmartVillage/
├─ src/                         เว็บไซต์ React
│  ├─ app/                     ตัวประกอบแอปและหน้าจอส่วนกลาง
│  ├─ features/public/         หน้าแรก เข้าสู่ระบบ และสมัครสมาชิก
│  ├─ features/citizen/        ส่วนประชาชน
│  ├─ features/village/        ส่วนผู้ดูแลหมู่บ้าน
│  ├─ features/tao/            ส่วนฝ่าย อบต.
│  ├─ core/                    บทบาทและกติกาหลักของระบบ
│  ├─ config/                  ค่ากลางของระบบ
│  ├─ data/                    ข้อมูลตัวอย่าง
│  ├─ services/                เชื่อม API และ Firebase
│  ├─ styles/                  CSS กลาง
│  ├─ utils/                   สูตรคำนวณและฟังก์ชันช่วย
│  ├─ App.jsx                  จุดเชื่อมตัวแอป
│  └─ main.jsx                 จุดเริ่ม React
├─ backend/                     Laravel API
│  ├─ app/Http/Controllers/Tao/      API ของฝ่าย อบต.
│  ├─ app/Http/Controllers/Village/  API ของผู้ดูแลหมู่บ้าน
│  ├─ app/Http/Controllers/Cases/    API เรื่องร้องทุกข์ประชาชน
│  ├─ app/Http/Controllers/Shared/   API ที่ใช้ร่วมกัน
│  ├─ app/Models/              โมเดลฐานข้อมูล
│  ├─ database/migrations/     ประวัติโครงสร้างฐานข้อมูล
│  ├─ database/seeders/        ข้อมูลตั้งต้น
│  ├─ routes/api.php           รายการ API
│  └─ tests/                   การทดสอบ Backend
├─ public/                      ไฟล์สาธารณะของ Frontend
├─ docs/                        คู่มือและเอกสารโครงการ
├─ scripts/                     สคริปต์ดูแลระบบ
├─ START-SMART-VILLAGE.cmd      เปิดระบบ
├─ CHECK-SMART-VILLAGE.cmd      ตรวจความพร้อมระบบ
└─ README.md                    ภาพรวมและวิธีเริ่มต้น
```

## ไฟล์ที่ถูกซ่อนใน VS Code

`.tools`, `node_modules`, `vendor`, `dist`, cache, log และ lockfile เป็นไฟล์ที่โปรแกรมสร้างหรือ dependencies ของระบบ ไม่ใช่จุดที่ควรแก้โค้ด จึงซ่อนไว้จาก Explorer แต่ไม่ได้ลบทิ้ง

## กติกาเพื่อไม่ให้กลับมารกอีก

1. หน้าเว็บใหม่ให้เพิ่มใน `src/app/` หรือแยกเป็น `src/features/` เมื่อมีขนาดใหญ่
2. ห้ามวางไฟล์ `.jsx`, `.js`, `.ps1` หรือ `.sh` เพิ่มที่รากโครงการ
3. เอกสารทุกฉบับเก็บใน `docs/`
4. สคริปต์ทุกตัวเก็บใน `scripts/`
5. รูปที่เป็นส่วนหนึ่งของหน้าเว็บเก็บใน `public/`; รูปที่ผู้ใช้อัปโหลดให้ Backend ดูแลใน `backend/storage/`
