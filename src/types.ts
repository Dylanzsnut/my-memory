export type CaptureType = 'photo' | 'voice' | 'note';
export type InferenceSource = 'ON_DEVICE' | 'IN_CLOUD' | 'SIMULATED';
export type RetentionState = 'active' | 'proposed' | 'trashed' | 'protected';
export type Language = 'en' | 'vi';
export type Tab = 'memories' | 'ask' | 'forget';

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
  /** Demo/sample marker so synthetic data is never mistaken for real captures. */
  demo?: boolean;
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
export type Decision = 'approve' | 'keep';

export interface ForgetProposal {
  id: string;
  captureId: string;
  reason: ForgetReason;
  evidence: string;
  score?: number;
  relatedCaptureId?: string;
  createdAt: string;
  decided?: Decision;
}

export interface HudEvent {
  id: string;
  at: string;
  label: string;
  source: InferenceSource;
  latencyMs: number;
  detail?: string;
}

export interface AppSettings {
  onboardingDone: boolean;
  language: Language;
  duplicateThreshold: number;
  retrievalThreshold: number;
  trashRetentionDays: number;
  cloudModel: string;
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
