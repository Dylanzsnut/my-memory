import type { AppSettings } from '../types';

const env = import.meta.env;

const num = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

export const recaptchaSiteKey = env.VITE_RECAPTCHA_SITE_KEY || '';

export const settings: AppSettings = {
  onboardingDone: false,
  language: 'en',
  duplicateThreshold: num(env.VITE_DUPLICATE_THRESHOLD, 0.97),
  retrievalThreshold: num(env.VITE_RETRIEVAL_THRESHOLD, 0.35),
  trashRetentionDays: num(env.VITE_TRASH_RETENTION_DAYS, 30),
  cloudModel: env.VITE_CLOUD_MODEL || 'gemini-3.8-flash',
};

export const FALLBACK_CLOUD_MODEL = 'gemini-3.5-flash-lite';
export const SEED_DEMO = env.VITE_SEED_DEMO !== 'false';

// Firestore metadata sync is opt-in. It stays off unless explicitly enabled
// AND Firebase Auth + per-user rules are in place (see firestore.rules).
export const enableFirestoreSync = env.VITE_ENABLE_FIRESTORE_SYNC === 'true';

export const ON_DEVICE_PROMPT_INSTRUCTIONS =
  'You extract concise, factual information from a personal capture. Never invent or infer values that are not explicitly present. Return only facts that appear in the capture.';
