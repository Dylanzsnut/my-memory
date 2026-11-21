import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  ReCaptchaV3Provider,
} from 'firebase/app-check';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
} from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import {
  getRemoteConfig,
  fetchAndActivate,
  getValue,
  setLogLevel,
  type RemoteConfig,
} from 'firebase/remote-config';
import type { AI } from 'firebase/ai';
import type { AuthSession, CaptureRecord } from '../types';
import { captureExpiry } from './expiry';
import {
  enableFirestoreSync,
  firebaseConfig,
  isFirebaseConfigured,
  recaptchaSiteKey,
  settings,
} from './config';

interface Services {
  app: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
  remoteConfig: RemoteConfig | null;
  ai: AI | null;
  error: string | null;
}

const services: Services = {
  app: null,
  auth: null,
  firestore: null,
  remoteConfig: null,
  ai: null,
  error: isFirebaseConfigured ? null : 'Firebase config missing — running in local demo mode.',
};

let firestoreSdkPromise: Promise<typeof import('firebase/firestore')> | null = null;

function loadFirestoreSdk() {
  return (firestoreSdkPromise ??= import('firebase/firestore'));
}

export function getServices(): Services {
  return services;
}

export async function initFirebase(): Promise<Services> {
  if (!isFirebaseConfigured || services.app) return services;
  try {
    const app = initializeApp(firebaseConfig);
    services.app = app;

    // App Check is required by Firebase AI Logic. Local development uses the
    // debug provider (allow-list the token printed in the browser console);
    // production uses a reCAPTCHA Enterprise score-based site key.
    if (import.meta.env.DEV) {
      (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
        true;
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider('local-debug-placeholder'),
        isTokenAutoRefreshEnabled: true,
      });
    } else if (recaptchaSiteKey) {
      initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } else {
      services.error = 'Production App Check site key is missing (VITE_RECAPTCHA_SITE_KEY).';
    }

    services.auth = getAuth(app);
    if (enableFirestoreSync) {
      const { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } =
        await loadFirestoreSdk();
      services.firestore = initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      });
    }

    // Lazy-load firebase/ai so offline/demo sessions avoid downloading AI SDK code upfront.
    // Generative models use 5-minute limited-use App Check tokens for replay
    // protection; without this flag those requests fail with HTTP 403.
    const { getAI, GoogleAIBackend } = await import('firebase/ai');
    services.ai = getAI(app, {
      backend: new GoogleAIBackend(),
      useLimitedUseAppCheckTokens: true,
    });

    const remoteConfig = getRemoteConfig(app);
    setLogLevel(remoteConfig, 'error');
    remoteConfig.settings.minimumFetchIntervalMillis = import.meta.env.DEV ? 0 : 3_600_000;
    remoteConfig.defaultConfig = {
      cloud_model: settings.cloudModel,
      duplicate_threshold: settings.duplicateThreshold,
      retrieval_threshold: settings.retrievalThreshold,
      trash_retention_days: settings.trashRetentionDays,
      group_threshold_photo: settings.groupThresholdPhoto,
      group_threshold_voice: settings.groupThresholdVoice,
      group_threshold_note: settings.groupThresholdNote,
    };
    const REMOTE_CONFIG_TIMEOUT_MS = 2000;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      fetchAndActivate(remoteConfig).catch(() => undefined),
      new Promise<void>((resolve) => {
        timeoutId = setTimeout(resolve, REMOTE_CONFIG_TIMEOUT_MS);
      }),
    ]).finally(() => {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    });
    services.remoteConfig = remoteConfig;

    const validPositive = (value: number, max?: number): number | null =>
      Number.isFinite(value) && value > 0 && (max === undefined || value <= max) ? value : null;

    const cloudModel = getValue(remoteConfig, 'cloud_model').asString().trim();
    if (cloudModel) settings.cloudModel = cloudModel;

    const dupThreshold = validPositive(Number(getValue(remoteConfig, 'duplicate_threshold').asString()), 1);
    if (dupThreshold !== null) settings.duplicateThreshold = dupThreshold;

    const retThreshold = validPositive(Number(getValue(remoteConfig, 'retrieval_threshold').asString()), 1);
    if (retThreshold !== null) settings.retrievalThreshold = retThreshold;

    const trashDays = validPositive(Number(getValue(remoteConfig, 'trash_retention_days').asNumber()));
    if (trashDays !== null) settings.trashRetentionDays = trashDays;

    const groupPhoto = validPositive(Number(getValue(remoteConfig, 'group_threshold_photo').asString()), 1);
    if (groupPhoto !== null) settings.groupThresholdPhoto = groupPhoto;

    const groupVoice = validPositive(Number(getValue(remoteConfig, 'group_threshold_voice').asString()), 1);
    if (groupVoice !== null) settings.groupThresholdVoice = groupVoice;

    const groupNote = validPositive(Number(getValue(remoteConfig, 'group_threshold_note').asString()), 1);
    if (groupNote !== null) settings.groupThresholdNote = groupNote;
  } catch (error) {
    services.error = error instanceof Error ? error.message : String(error);
    console.warn('[firebase] initialization failed', error);
  }
  return services;
}

export async function signInWithGoogle(): Promise<AuthSession> {
  if (!services.auth) {
    await initFirebase();
  }
  if (!services.auth) {
    throw new Error('Firebase Auth is not configured in this build.');
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('offline');
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(services.auth, provider);
  return {
    mode: 'google',
    uid: cred.user.uid,
    email: cred.user.email,
    displayName: cred.user.displayName,
  };
}

export async function signOutFirebase(): Promise<void> {
  if (!services.auth) return;
  await firebaseSignOut(services.auth).catch(() => undefined);
}

/**
 * Metadata-only sync, gated behind an explicit opt-in and a real Google UID.
 * Originals, transcripts, embeddings, and user tags never leave the device.
 * Demo/sample records are never synced.
 */
export async function syncCaptureMetadata(captures: CaptureRecord[], uid?: string): Promise<void> {
  if (!enableFirestoreSync || !uid || uid === 'demo') return;
  const firestore = services.firestore;
  if (!firestore) return;
  try {
    const { doc, setDoc } = await loadFirestoreSdk();
    for (const capture of captures) {
      if (capture.demo) continue;
      await setDoc(doc(firestore, 'users', uid, 'captures', capture.id), {
        id: capture.id,
        type: capture.type,
        capturedAt: capture.capturedAt,
        summary: capture.summary,
        entities: capture.entities,
        expiryDate: captureExpiry(capture),
        language: capture.language,
        inferenceSource: capture.inferenceSource,
        retentionState: capture.retentionState,
      });
    }
  } catch (error) {
    // Never let a sync failure become an unhandled rejection or block capture.
    console.warn('[firebase] metadata sync failed', error);
  }
}

export async function deleteCaptureMetadata(captureId: string, uid?: string): Promise<void> {
  if (!enableFirestoreSync || !uid || uid === 'demo') return;
  const firestore = services.firestore;
  if (!firestore) return;
  try {
    const { deleteDoc, doc } = await loadFirestoreSdk();
    await deleteDoc(doc(firestore, 'users', uid, 'captures', captureId));
  } catch (error) {
    console.warn('[firebase] metadata delete failed', error);
  }
}

export async function deleteAllUserMetadata(uid: string, knownCaptureIds: string[]): Promise<void> {
  if (!enableFirestoreSync || !uid || uid === 'demo') return;
  const firestore = services.firestore;
  if (!firestore) return;
  try {
    const { collection, deleteDoc, doc, getDocs } = await loadFirestoreSdk();
    const colRef = collection(firestore, 'users', uid, 'captures');
    const snap = await getDocs(colRef).catch(() => null);
    const ids = new Set(knownCaptureIds);
    snap?.forEach((d) => ids.add(d.id));
    await Promise.all(
      Array.from(ids).map((id) =>
        deleteDoc(doc(firestore, 'users', uid, 'captures', id)).catch(() => undefined),
      ),
    );
  } catch (error) {
    console.warn('[firebase] deleteAllUserMetadata failed', error);
  }
}
