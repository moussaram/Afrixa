import { initializeApp, getApps } from "firebase/app";
import { getMessaging, isSupported, onRegistered, register as registerFcm } from "firebase/messaging";
import { supabase } from "@/integrations/supabase/client";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const firebaseReady = Object.values(firebaseConfig).every(Boolean)
  && Boolean(import.meta.env.VITE_FIREBASE_VAPID_KEY);

const ensureMessaging = async () => {
  if (!firebaseReady) throw new Error("La configuration Firebase des notifications est incomplète.");
  if (!(await isSupported())) throw new Error("Les notifications push ne sont pas prises en charge par ce navigateur.");
  const app = getApps()[0] ?? initializeApp(firebaseConfig);
  return getMessaging(app);
};

type TokenTable = {
  from: (name: "user_fcm_tokens") => any;
};
const tokenTable = () => (supabase as unknown as TokenTable).from("user_fcm_tokens");

export async function enableWebPush(userId: string): Promise<void> {
  if (!window.isSecureContext) throw new Error("Les notifications push nécessitent HTTPS.");
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    throw new Error("Ce navigateur ne permet pas les notifications push.");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Autorisez les notifications dans les réglages du navigateur.");

  const messaging = await ensureMessaging();
  const serviceWorker = await navigator.serviceWorker.ready;
  let unsubscribe = () => {};
  let timeout = 0;
  const installationId = new Promise<string>((resolve, reject) => {
    timeout = window.setTimeout(() => {
      unsubscribe();
      reject(new Error("Firebase n’a pas confirmé l’inscription de cet appareil."));
    }, 15_000);
    unsubscribe = onRegistered(messaging, (id) => {
      window.clearTimeout(timeout);
      unsubscribe();
      resolve(id);
    });
  });

  try {
    await registerFcm(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: serviceWorker,
    });
  } catch (error) {
    window.clearTimeout(timeout);
    unsubscribe();
    // Consume the pending promise rejection because registration failed first.
    void installationId.catch(() => undefined);
    throw error;
  }
  const id = await installationId;
  const { error } = await tokenTable().upsert({
    user_id: userId,
    token: id,
    platform: "web_fid",
    updated_at: new Date().toISOString(),
  }, { onConflict: "token" });
  if (error) throw error;
}

export async function disableWebPush(userId: string): Promise<void> {
  if (firebaseReady && await isSupported()) {
    const messaging = await ensureMessaging();
    // FID-based registration is removed by the SDK's unregister method.
    const { unregister } = await import("firebase/messaging");
    await unregister(messaging);
  }
  const { error } = await tokenTable().delete().eq("user_id", userId).eq("platform", "web_fid");
  if (error) throw error;
}
