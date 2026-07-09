import { api } from './api';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean);

export async function setupFirebaseNotifications(currentUser, onForegroundMessage) {
  if (!currentUser || !hasFirebaseConfig || !('Notification' in window)) {
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return null;
  }

  const token = [
    'web-notification-ready',
    firebaseConfig.projectId,
    currentUser.id,
  ].join(':');

  await api.saveNotificationToken({
    userId: currentUser.id,
    token,
    provider: 'firebase',
  });

  onForegroundMessage?.({
    id: `firebase-ready-${Date.now()}`,
    title: 'เปิดใช้งานการแจ้งเตือนแล้ว',
    desc: 'ระบบพร้อมรับการแจ้งเตือนผ่าน Firebase Cloud Messaging เมื่อเชื่อมต่อ Laravel Backend',
    isRead: false,
    time: 'เมื่อสักครู่',
  });

  return null;
}
