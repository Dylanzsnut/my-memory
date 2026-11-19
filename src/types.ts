export type CaptureType = 'photo' | 'voice' | 'note';
export type InferenceSource = 'ON_DEVICE' | 'IN_CLOUD' | 'SIMULATED';
export type RetentionState = 'active' | 'proposed' | 'trashed' | 'protected';
export type Language = 'en' | 'vi';
export type Tab = 'memories' | 'ask' | 'forget' | 'trash';
export type AuthMode = 'google' | 'demo';

export interface AuthSession {
  mode: AuthMode;
  uid: string;
  email: string | null;
  displayName?: string | null;
}

export interface Extraction {
  summary: string;
  entities: string[];
  expiryDate: string | null;
}

export interface CaptureRecord {
  id: string;
  type: CaptureType;
  capturedAt: string;
  summary: string;
  entities: string[];
  expiryDate: string | null;
  language: Language;
  inferenceSource: InferenceSource;
  retentionState: RetentionState;
  /** Local blob URL / data URL for the original. Never leaves the device. */
  originalRef?: string;
  /** Recorded audio blob stored locally in IndexedDB. Never leaves the device. */
  audioBlob?: Blob;
  audioMimeType?: string;
  /** OCR / ASR derived text. Correctable; never mutates the original. */
  derivedText?: string;
  /** Vector embedding (shared space, lexical fallback in this build). */
  embedding: number[];
  sourceMatch?: { score: number; captureId: string };
  protectedReason?: string;
  /** When the capture was moved to the trash. */
  trashedAt?: string;
  /** When the recoverable trash window ends and the capture may be purged. */
  purgeAt?: string;
  /** Origin of trash transition so manual deletion stays distinct from proposal approval. */
  trashSource?: 'proposal' | 'manual';
  /** User-authored tags (local only, never synced to Firestore). */
  tags?: string[];
  /** Model/grouping-derived tag proposals (local only, never synced). */
  suggestedTags?: string[];
  /** Demo/sample marker so synthetic data is never mistaken for real captures. */
  demo?: boolean;
  /** Owning user UID (or 'demo' for local demo sandbox) to partition IndexedDB. */
  ownerUid?: string;
  /** Set when the user has manually assigned this capture to a group; auto-reconcile skips it. */
  manualGroupLock?: boolean;
}

/** Local-only, user-editable embedding group (never synced to Firestore). */
export interface MemoryGroup {
  id: string;
  name: string;
  captureIds: string[];
  source: 'auto' | 'manual';
  createdAt: string;
  updatedAt: string;
  ownerUid?: string;
}

export interface TagGroupProposal {
  id: string;
  fingerprint: string;
  label: string;
  captureIds: string[];
  meanSimilarity: number;
}

export interface SearchResult {
  capture: CaptureRecord;
  score: number;
}

export interface Claim {
  text: string;
  captureId: string;
  verified: boolean;
}

export interface AnswerResult {
  text: string;
  claims: Claim[];
  sources: CaptureRecord[];
  inferenceSource: InferenceSource;
  latencyMs: number;
  intent: 'short' | 'long';
  notFound: boolean;
  /** Populated when a live inference call failed and a local fallback was used. */
  error?: string;
}

export type ForgetReason = 'duplicate' | 'expired';
export type Decision = 'approve' | 'keep' | 'manual';

export interface ForgetProposal {
  id: string;
  captureId: string;
  reason: ForgetReason;
  evidence: string;
  score?: number;
  relatedCaptureId?: string;
  createdAt: string;
  decided?: Decision;
  ownerUid?: string;
}

export interface HudEvent {
  id: string;
  at: string;
  label: string;
  source: InferenceSource;
  latencyMs: number;
  detail?: string;
  ownerUid?: string;
}

export interface AppSettings {
  onboardingDone: boolean;
  language: Language;
  duplicateThreshold: number;
  retrievalThreshold: number;
  trashRetentionDays: number;
  cloudModel: string;
  groupThresholdPhoto: number;
  groupThresholdVoice: number;
  groupThresholdNote: number;
}

export interface ExtractionRequest {
  type: CaptureType;
  text?: string;
  imageDataUrl?: string;
  audioBlob?: Blob;
  audioMimeType?: string;
  capturedAt?: string;
}

export interface ExtractionResult {
  extraction: Extraction | null;
  source: InferenceSource;
  latencyMs: number;
  error?: string;
}
