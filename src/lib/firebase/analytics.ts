import type { Analytics } from 'firebase/analytics';
import { firebaseConfig, firebaseAppConfigured, getFirebaseApp } from '@/lib/firebase/config';

const CONSENT_KEY = 'afrixa:analytics-consent:v1';
let analyticsInstance: Analytics | null = null;
let analyticsSdk: typeof import('firebase/analytics') | null = null;

const getAnalyticsSdk = async () => {
  analyticsSdk ??= await import('firebase/analytics');
  return analyticsSdk;
};

export const getAnalyticsConsent = (): boolean => {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'granted';
  } catch {
    return false;
  }
};

const consentSettings = (granted: boolean) => ({
  analytics_storage: granted ? 'granted' as const : 'denied' as const,
  ad_storage: 'denied' as const,
  ad_user_data: 'denied' as const,
  ad_personalization: 'denied' as const,
});

async function getEnabledAnalytics(): Promise<Analytics | null> {
  if (!getAnalyticsConsent() || !firebaseAppConfigured || !firebaseConfig.measurementId) return null;
  try {
    const sdk = await getAnalyticsSdk();
    if (!(await sdk.isSupported())) return null;
    if (!analyticsInstance) {
      // Analytics is not initialized at all until the person explicitly opts in.
      analyticsInstance = sdk.getAnalytics(getFirebaseApp());
      sdk.setConsent(consentSettings(true));
      sdk.setAnalyticsCollectionEnabled(analyticsInstance, true);
    }
    return analyticsInstance;
  } catch {
    return null;
  }
}

export async function setAnalyticsConsent(enabled: boolean): Promise<void> {
  try {
    localStorage.setItem(CONSENT_KEY, enabled ? 'granted' : 'denied');
  } catch {
    if (enabled) throw new Error('Impossible d’enregistrer votre choix de confidentialité.');
  }

  if (!enabled) {
    if (analyticsInstance) {
      const sdk = await getAnalyticsSdk();
      sdk.setConsent(consentSettings(false));
      sdk.setAnalyticsCollectionEnabled(analyticsInstance, false);
    }
    return;
  }

  if (!firebaseConfig.measurementId) throw new Error('La mesure Firebase Analytics n’est pas configurée.');
  const analytics = await getEnabledAnalytics();
  if (!analytics) throw new Error('Firebase Analytics est indisponible sur ce navigateur.');
  const sdk = await getAnalyticsSdk();
  sdk.setConsent(consentSettings(true));
  sdk.setAnalyticsCollectionEnabled(analytics, true);
}

async function track(eventName: string, params?: Record<string, string | number>): Promise<void> {
  const analytics = await getEnabledAnalytics();
  if (analytics) (await getAnalyticsSdk()).logEvent(analytics, eventName, params);
}

export const trackPageView = (pageName: string) => track('page_view', { page_name: pageName });
export const trackVideoView = () => track('video_view', { content_type: 'video' });
export const trackVideoComplete = (durationSeconds: number) => track('video_complete', { duration_seconds: Math.round(durationSeconds) });
export const trackVideoLike = () => track('video_like', { content_type: 'video' });
export const trackProductView = (price: number, currency: string) => track('view_item', { value: price, currency });
export const trackPurchase = (amount: number, currency: string) => track('purchase', { value: amount, currency });
export const trackFollow = () => track('follow_creator');
export const trackLiveJoin = () => track('live_join');
export const trackSearch = () => track('search');
