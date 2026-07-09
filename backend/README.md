# SmartVillage Backend Scope

โฟลเดอร์นี้เป็นตัวอย่างโครง Backend ที่ต้องย้ายเข้าโปรเจกต์ Laravel จริง หรือสร้างด้วยคำสั่ง `composer create-project laravel/laravel backend` แล้วนำแนว API/migration ด้านล่างไปใช้

## เทคโนโลยีฝั่ง Backend

1. Laravel Framework สำหรับ REST API
2. PHP สำหรับ business logic และ controller
3. MySQL สำหรับตาราง users, news, incidents, notifications และ notification_tokens
4. Firebase Cloud Messaging สำหรับส่งแจ้งเตือนแบบ real-time/push notification

## API หลักที่ Frontend เรียกใช้

- `GET /api/bootstrap`
- `POST /api/login`
- `POST /api/register`
- `POST /api/incidents`
- `PATCH /api/incidents/{incident}/status`
- `DELETE /api/incidents/{incident}`
- `POST /api/news`
- `PUT /api/news/{news}`
- `DELETE /api/news/{news}`
- `DELETE /api/users/{user}`
- `POST /api/notification-tokens`

## ขั้นตอนถัดไปเมื่อติดตั้ง Laravel จริง

1. ตั้งค่า `.env` ของ Laravel ให้เชื่อม MySQL
2. สร้าง migration ตามไฟล์ตัวอย่างใน `database/migrations`
3. เพิ่ม routes จาก `routes/api.php`
4. สร้าง Controller/Model ตาม endpoint ด้านบน
5. ใส่ Firebase service account ในฝั่ง Laravel เพื่อส่ง FCM ตอนมีข่าวใหม่หรือสถานะงานเปลี่ยน
