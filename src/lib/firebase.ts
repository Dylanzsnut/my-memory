import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  ReCaptchaV3Provider,
} from 'firebase/app-check';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import {
  getRemoteConfig,
  fetchAndActivate,
  getValue,
  setLogLevel,
  type RemoteConfig,
} from 'firebase/remote-config';
import { getAI, GoogleAIBackend, type AI } from 'firebase/ai';
import type { CaptureRecord } from '../types';
import {
  enableFirestoreSync,
  firebaseConfig,
  isFirebaseConfigured,
  recaptchaSiteKey,
  settings,
} from './config';

interface Services {
  app: FirebaseApp | null;
  firestore: Firestore | null;
  remoteConfig: RemoteConfig | null;
  ai: AI | null;
  error: string | null;
}

const services: Services = {
  app: null,
  firestore: null,
  remoteConfig: null,
  ai: null,
  error: isFirebaseConfigured ? null : 'Firebase config missing — running in local demo mode.',
};

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

    services.firestore = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });

    // Generative models use 5-minute limited-use App Check tokens for replay
    // protection; without this flag those requests fail with HTTP 403.
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
  } catch (error) {
    services.error = error instanceof Error ? error.message : String(error);
    console.warn('[firebase] initialization failed', error);
  }
  return services;
}

/**
 * Metadata-only sync, gated behind an explicit opt-in. Originals, transcripts
 * and embeddings never leave the device. Demo/sample records are never synced.
 */
export async function syncCaptureMetadata(captures: CaptureRecord[]): Promise<void> {
  if (!enableFirestoreSync) return;
  const firestore = services.firestore;
  if (!firestore) return;
  try {
    for (const capture of captures) {
      if (capture.demo) continue;
      await setDoc(doc(firestore, 'captures', capture.id), {
        id: capture.id,
        type: capture.type,
        capturedAt: capture.capturedAt,
        summary: capture.summary,
        entities: capture.entities,
        expiryDate: capture.expiryDate,
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
