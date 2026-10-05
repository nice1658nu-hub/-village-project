/* global firebase */
importScripts('https://www.gstatic.com/firebasejs/12.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging-compat.js');

const encodedConfig = new URL(self.location.href).searchParams.get('config');

if (encodedConfig) {
  try {
    firebase.initializeApp(JSON.parse(atob(decodeURIComponent(encodedConfig))));
    firebase.messaging().onBackgroundMessage(payload => {
      const title = payload.notification?.title || payload.data?.title || 'ระบบแจ้งเหตุ ติดตาม และวิเคราะห์ปัญหาชุมชนอัจฉริยะ';
      const data = { ...(payload.data || {}) };
      const params = new URLSearchParams();
      if (data.type) params.set('notification_type', data.type);
      if (data.notification_id) params.set('notification_id', data.notification_id);
      if (data.incident_id) params.set('incident_id', data.incident_id);
      if (data.user_id) params.set('user_id', data.user_id);
      if (data.project_id) params.set('project_id', data.project_id);
      data.targetUrl = `/${params.toString() ? `?${params.toString()}` : ''}`;
      self.registration.showNotification(title, {
        body: payload.notification?.body || payload.data?.description || 'มีการอัปเดตใหม่',
        icon: '/logo1.png',
        badge: '/logo1.png',
        data,
      });
    });
  } catch (error) {
    console.error('Firebase messaging service worker configuration failed.', error);
  }
}

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.targetUrl || '/', self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    const existing = windows.find(client => 'focus' in client && 'navigate' in client);
    if (existing) return existing.navigate(targetUrl).then(client => client.focus());
    return clients.openWindow(targetUrl);
  }));
});
