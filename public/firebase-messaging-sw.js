// Firebase Cloud Messaging Service Worker
// This file must be served from the root of your domain

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize Firebase in the SW
// IMPORTANT: Replace these with your actual Firebase config values
firebase.initializeApp({
  apiKey: self.FIREBASE_API_KEY || 'YOUR_API_KEY',
  authDomain: self.FIREBASE_AUTH_DOMAIN || 'YOUR_AUTH_DOMAIN',
  projectId: self.FIREBASE_PROJECT_ID || 'YOUR_PROJECT_ID',
  storageBucket: self.FIREBASE_STORAGE_BUCKET || 'YOUR_STORAGE_BUCKET',
  messagingSenderId: self.FIREBASE_MESSAGING_SENDER_ID || 'YOUR_SENDER_ID',
  appId: self.FIREBASE_APP_ID || 'YOUR_APP_ID',
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  const notificationTitle = payload.notification?.title || 'Bhandara Finder';
  const notificationOptions = {
    body: payload.notification?.body || 'New update',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [100, 50, 100],
    data: payload.data,
    actions: [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const bhandaraId = event.notification.data?.bhandaraId;
  const urlToOpen = bhandaraId
    ? new URL(`/bhandara/${bhandaraId}`, self.location.origin).href
    : new URL('/', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(urlToOpen);
    })
  );
});
