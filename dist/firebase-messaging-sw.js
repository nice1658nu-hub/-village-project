importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'replace-with-env-value-when-deploying',
  authDomain: 'replace-with-env-value-when-deploying',
  projectId: 'replace-with-env-value-when-deploying',
  storageBucket: 'replace-with-env-value-when-deploying',
  messagingSenderId: 'replace-with-env-value-when-deploying',
  appId: 'replace-with-env-value-when-deploying',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'SmartVillage';
  const options = {
    body: payload.notification?.body || 'มีการแจ้งเตือนใหม่จากระบบ',
    icon: '/vite.svg',
  };

  self.registration.showNotification(title, options);
});
