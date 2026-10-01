import { api } from './api';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean) && Boolean(vapidKey);

export async function setupFirebaseNotifications(currentUser, onForegroundMessage) {
  if (!currentUser || !hasFirebaseConfig || !('Notification' in window) || !('serviceWorker' in navigator)) return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const [{ initializeApp }, { getMessaging, getToken, isSupported, onMessage }] = await Promise.all([
    import('firebase/app'),
    import('firebase/messaging'),
  ]);
  if (!await isSupported()) return null;

  const workerConfig = encodeURIComponent(btoa(JSON.stringify(firebaseConfig)));
  const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?config=${workerConfig}`);
  const messaging = getMessaging(initializeApp(firebaseConfig));
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  if (!token) return null;

  await api.saveNotificationToken({ token, provider: 'firebase' });

  return onMessage(messaging, payload => {
    onForegroundMessage?.({
      id: `firebase-${payload.messageId || Date.now()}`,
      title: payload.notification?.title || payload.data?.title || 'การแจ้งเตือนใหม่',
      desc: payload.notification?.body || payload.data?.description || '',
      isRead: false,
      time: 'เมื่อสักครู่',
      data: payload.data || {},
    });
  });
}
