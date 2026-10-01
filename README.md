# SmartVillage

ระบบแจ้งเหตุ ร้องเรียน ติดตามสถานะ และประกาศข่าวสารสำหรับหมู่บ้าน พัฒนาโดยแยกหน้าบ้านเป็น React และเตรียมจุดเชื่อมต่อ Backend เป็น Laravel API

## ขอบเขตด้านเทคโนโลยี

1. Laravel Framework สำหรับพัฒนาระบบฝั่งเซิร์ฟเวอร์ (Backend)
2. PHP สำหรับพัฒนา API และจัดการตรรกะของระบบ
3. MySQL สำหรับจัดเก็บข้อมูลของระบบ
4. React.js และ Vite สำหรับพัฒนาเว็บไซต์ฝั่งผู้ใช้งาน (Frontend)
5. HTML, CSS, JavaScript และ Tailwind CSS สำหรับออกแบบและตกแต่งหน้าจอ
6. Firebase สำหรับระบบแจ้งเตือนแบบเรียลไทม์
7. Visual Studio Code (VS Code) สำหรับพัฒนาโปรแกรม

## สถานะของโปรเจกต์

- Frontend ปัจจุบันอยู่ใน `React + Vite + Tailwind CSS`
- มี service สำหรับเรียก `Laravel API` ใน `src/services/api.js`
- มี service สำหรับเตรียมระบบแจ้งเตือน `Firebase` ใน `src/services/firebaseNotifications.js`
- มีตัวอย่างโครง `Laravel/PHP/MySQL` ในโฟลเดอร์ `backend/`
- ถ้ายังไม่ได้รัน Laravel Backend หน้าเว็บจะใช้ข้อมูลตัวอย่างจาก `src/data/mockData.js` เพื่อให้เดโม่ได้ต่อเนื่อง

## ติดตั้ง Frontend

```bash
npm install
```

## ตั้งค่า Environment

คัดลอก `.env.example` เป็น `.env` แล้วแก้ค่าตามเครื่องที่ใช้งาน

```bash
VITE_API_BASE_URL=http://localhost:8000/api
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_PROJECT_ID=your-project-id
```

## รัน Frontend

```bash
npm run dev
```

## Build สำหรับส่งงาน

```bash
npm run build
```

## โครงสร้างหลัก

- `src/` เว็บไซต์ React ทั้งหมด
  - `App.jsx` หน้าจอและการทำงานหลัก
  - `config/` ชื่อระบบและค่ากลาง
  - `data/` ข้อมูลตัวอย่างสำหรับเดโม่
  - `services/` การเชื่อม Laravel API และ Firebase
  - `utils/` ฟังก์ชันคำนวณและแปลงข้อมูล
- `backend/` Laravel API, Models, Controllers และฐานข้อมูล
- `public/` ไฟล์สาธารณะที่เบราว์เซอร์เรียกใช้
- `docs/` เอกสารระบบ คู่มือ และสถานะโครงการ
- `scripts/` สคริปต์เปิดระบบ ตรวจระบบ และตั้งค่า Gmail

ไฟล์ `.cmd` ที่รากโปรเจกต์มีไว้สำหรับดับเบิลคลิกเปิดระบบ ตรวจระบบ และตั้งค่า Gmail เท่านั้น ส่วนไฟล์ระบบที่ไม่จำเป็นต่อการแก้โค้ดถูกซ่อนจาก VS Code Explorer แล้ว

หากไม่ทราบว่าต้องแก้ไฟล์ใด ให้เปิด [`docs/PROJECT-STRUCTURE.md`](docs/PROJECT-STRUCTURE.md) ซึ่งมีตาราง “งานที่ต้องการทำ → ตำแหน่งไฟล์” ภาษาไทย

## หมายเหตุสำหรับอธิบายอาจารย์

โปรเจกต์นี้เพิ่ม React.js, Vite และ Tailwind CSS เข้ามาเพื่อพัฒนาหน้าจอฝั่งผู้ใช้งานให้โต้ตอบได้ดีขึ้น ส่วน Laravel, PHP, MySQL และ Firebase ยังคงอยู่ในขอบเขตเดิม โดยใช้เป็น Backend, ฐานข้อมูล และระบบแจ้งเตือนของระบบ
