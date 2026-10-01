# รายการเตรียมนำระบบขึ้นออนไลน์

## ต้องทำก่อนเปิดให้ผู้ใช้จริง

- [ ] เลือก Hosting ที่รองรับ PHP/Laravel, MySQL และ HTTPS
- [ ] ตั้ง `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL=https://...`
- [ ] ตั้งค่า Frontend `VITE_API_BASE_URL` เป็น URL ของ Backend
- [ ] สร้างฐานข้อมูล production และรัน `php artisan migrate --force`
- [ ] ตั้ง Gmail SMTP หรือผู้ให้บริการอีเมล production
- [ ] ตั้ง CORS ให้ยอมรับเฉพาะโดเมน Frontend
- [ ] ตั้ง API keys ให้จำกัดโดเมน/IP และห้ามนำ secret เข้า Git
- [ ] รัน `php artisan config:cache` และ `php artisan route:cache`
- [x] สร้าง Frontend ด้วย `npm run build` (ตรวจล่าสุด 24 ก.ย. 2569)
- [ ] ตรวจสิทธิ์โฟลเดอร์ `storage` และ `bootstrap/cache`
- [ ] ตั้ง Cron/Scheduler และ Queue worker หากใช้ส่งงานเบื้องหลัง
- [ ] ตั้งสำรอง MySQL และไฟล์อัปโหลด พร้อมทดสอบกู้คืน
- [ ] ตั้ง Budget Alert ใน Google Cloud/Firebase และกำหนด quota
- [x] ทดสอบหน้าหลักทุกบทบาทและตรวจ responsive overflow บนมือถือ แท็บเล็ต และคอมพิวเตอร์ (24 ก.ย. 2569)
- [x] ทดสอบ Backend 20 tests / 65 assertions รวมสิทธิ์งบประมาณและ workflow ครบทุกบทบาท
- [x] ติดตั้ง Firebase Web SDK และ Laravel Firebase Admin SDK พร้อม Service Worker

## ค่าใช้จ่ายที่ควบคุมได้

Leaflet/OpenStreetMap ที่ใช้อยู่ไม่ต้องมี API key แต่ production ที่มีผู้ใช้มากควรเลือกผู้ให้บริการ tile ที่มีเงื่อนไขรองรับงานจริง ส่วน Google Maps และ Firebase ต้องตรวจราคา/โควตาปัจจุบันและตั้ง Budget Alert เพราะการผูกบัตรหรือมีเครดิตฟรีไม่ได้รับประกันว่าจะไม่เกิดค่าใช้จ่ายหลังหมดโควตา

## งานที่ต้องใช้บัญชีเจ้าของโครงการ

1. สร้าง Google App Password สำหรับ Gmail แล้วรัน `SETUP-GMAIL.cmd` โดยกรอกบนเครื่องตนเอง
2. สร้าง Firebase project, Web App, VAPID key และ Service Account สำหรับ Push Notification จริง
3. ซื้อ/กำหนดโดเมนและเชื่อม Hosting
4. กำหนดอีเมลผู้ดูแลระบบและเปลี่ยนรหัสผ่านสาธิตก่อนเปิดจริง
