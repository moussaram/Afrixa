/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";
import { initializeApp } from "firebase/app";
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision?: string | null }>;
};

precacheAndRoute(self.__WB_MANIFEST);

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId) {
  const messaging = getMessaging(initializeApp(firebaseConfig));
  onBackgroundMessage(messaging, async (payload) => {
    const title = payload.notification?.title || "Afrixa";
    const options: NotificationOptions = {
      body: payload.notification?.body,
      icon: "/afrixa-icon.png",
      data: payload.data ?? {},
    };
    await self.registration.showNotification(title, options);
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = typeof event.notification.data?.url === "string"
    ? event.notification.data.url
    : "/notifications";
  const parsedTarget = new URL(target, self.location.origin);
  const safeTarget = parsedTarget.origin === self.location.origin
    ? parsedTarget.href
    : new URL("/notifications", self.location.origin).href;
  event.waitUntil(self.clients.openWindow(safeTarget));
});
