# ตั้งค่า Firebase Push Notification

## 1. สร้าง Firebase Project และ Web App

1. เปิด Firebase Console และสร้างโปรเจกต์
2. กดเพิ่มแอปแบบ Web (`</>`)
3. คัดลอกค่า `firebaseConfig`
4. เปิด Project settings > Cloud Messaging
5. ใน Web Push certificates กด Generate key pair แล้วคัดลอก VAPID key

สร้างไฟล์ `.env` ที่รากโปรเจกต์จาก `.env.example` และกรอก:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_VAPID_KEY=
```

ห้ามใส่เครื่องหมายคำพูด และต้องปิด/เปิด Vite ใหม่หลังแก้ `.env`

## 2. ตั้งค่า Laravel Admin SDK

1. Firebase Console > Project settings > Service accounts
2. กด Generate new private key และดาวน์โหลด JSON
3. สร้างโฟลเดอร์ `backend/storage/app/firebase`
4. นำไฟล์ไปวางเป็น `backend/storage/app/firebase/service-account.json`
5. ใน `backend/.env` ใส่ absolute path แบบ WSL:

```env
FIREBASE_CREDENTIALS=/mnt/c/Users/ASUS/Downloads/-village-project-main/-village-project-main/backend/storage/app/firebase/service-account.json
```

จากนั้นล้าง config cache และรีสตาร์ต backend:

```powershell
wsl bash -lc "cd /mnt/c/Users/ASUS/Downloads/-village-project-main/-village-project-main/backend && php artisan optimize:clear"
wsl -u root bash -lc "systemctl restart smart-village-backend.service"
```

## 3. ทดสอบ

1. เปิดเว็บด้วย Chrome หรือ Edge
2. เข้าสู่ระบบและกด Allow เมื่อเบราว์เซอร์ถามสิทธิ์แจ้งเตือน
3. ตรวจตาราง `notification_tokens` ในฐาน `smart_village` ต้องมี token ของผู้ใช้
4. ใช้อีกบัญชีเปลี่ยนสถานะเรื่องของผู้ใช้
5. ตรวจทั้งกระดิ่งในเว็บและการแจ้งเตือนของ Windows

Push Notification ใช้งานบน `localhost` ได้ แต่เมื่อนำขึ้นเซิร์ฟเวอร์จริงต้องใช้ HTTPS

