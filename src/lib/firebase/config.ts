import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const firebaseAppConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId
  && firebaseConfig.storageBucket && firebaseConfig.messagingSenderId && firebaseConfig.appId,
);

export function getFirebaseApp(): FirebaseApp {
  if (!firebaseAppConfigured) throw new Error('La configuration Firebase est incomplète.');
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}
