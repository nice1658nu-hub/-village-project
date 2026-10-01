/* global firebase */
importScripts('https://www.gstatic.com/firebasejs/12.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging-compat.js');

const encodedConfig = new URL(self.location.href).searchParams.get('config');

if (encodedConfig) {
  try {
    firebase.initializeApp(JSON.parse(atob(decodeURIComponent(encodedConfig))));
    firebase.messaging().onBackgroundMessage(payload => {
      const title = payload.notification?.title || payload.data?.title || 'SmartVillage';
      self.registration.showNotification(title, {
        body: payload.notification?.body || payload.data?.description || 'มีการอัปเดตใหม่',
        icon: '/favicon.ico',
        data: payload.data || {},
      });
    });
  } catch (error) {
    console.error('Firebase messaging service worker configuration failed.', error);
  }
}

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    const existing = windows.find(client => 'focus' in client);
    return existing ? existing.focus() : clients.openWindow('/');
  }));
});
