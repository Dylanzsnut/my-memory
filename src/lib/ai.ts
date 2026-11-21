import type { GenerativeModel } from 'firebase/ai';
import type {
  AnswerResult,
  CaptureRecord,
  ExtractionRequest,
  ExtractionResult,
  InferenceSource,
} from '../types';
import { getServices } from './firebase';
import { FALLBACK_CLOUD_MODEL, settings, ON_DEVICE_PROMPT_INSTRUCTIONS } from './config';
import { normalize } from './embeddings';
import { captureExpiry, expiryNumeric } from './expiry';

let aiSdkPromise: Promise<typeof import('firebase/ai')> | null = null;
let cachedExtractionJsonSchema: object | null = null;

function loadAiSdk() {
  return (aiSdkPromise ??= import('firebase/ai'));
}

function getExtractionJsonSchema(Schema: (typeof import('firebase/ai'))['Schema']): object {
  if (!cachedExtractionJsonSchema) {
    const extractionSchema = Schema.object({
      properties: {
        summary: Schema.string(),
        entities: Schema.array({ items: Schema.string() }),
        expiryDate: Schema.string({ nullable: true }),
      },
      optionalProperties: ['expiryDate'],
    });
    cachedExtractionJsonSchema = JSON.parse(JSON.stringify(extractionSchema)) as object;
  }
  return cachedExtractionJsonSchema;
}

function isValidYearMonthDay(year: number, month: number, day?: number): boolean {
  if (month < 1 || month > 12) return false;
  if (day === undefined) return true;
  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= maxDay;
}

function normalizeExpiryDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'null') return null;
  const iso = trimmed.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = iso[3] !== undefined ? Number(iso[3]) : undefined;
    return isValidYearMonthDay(year, month, day) ? trimmed : null;
  }
  const slash = trimmed.match(/^(\d{2})\/(\d{4})$/);
  if (slash) {
    const month = Number(slash[1]);
    const year = Number(slash[2]);
    return isValidYearMonthDay(year, month) ? `${slash[2]}-${slash[1]}` : null;
  }
  return null;
}

function toSdkSource(
  source: unknown,
  sdkInferenceSource?: { IN_CLOUD: unknown; ON_DEVICE: unknown },
): InferenceSource {
  // The SDK reports lowercase values ('in_cloud' / 'on_device'), not the
  // uppercase labels used by this app's UI and data model.
  if (source === sdkInferenceSource?.IN_CLOUD || source === 'IN_CLOUD' || source === 'in_cloud') {
    return 'IN_CLOUD';
  }
  if (source === sdkInferenceSource?.ON_DEVICE || source === 'ON_DEVICE' || source === 'on_device') {
    return 'ON_DEVICE';
  }
  return 'SIMULATED'; // unknown/missing provenance must never be shown as a real inference
}

function dataUrlToPart(dataUrl: string) {
  const [header, data] = dataUrl.split(',');
  const mimeType = header.match(/data:(.*?);base64/)?.[1] || 'image/jpeg';
  return { type: 'inlineData', inlineData: { data: data || '', mimeType } };
}

function simulatedExtraction(req: ExtractionRequest): ExtractionResult {
  const started = performance.now();
  const text = req.text || '';
  const amounts = text.match(/[\d.,]+\s*(?:VND|₫|K\b)/gi) || [];
  const dates = text.match(/\b\d{2}\/\d{4}\b/g) || [];
  const plates = text.match(/\b\d{2}[A-Z]-?\d+\.\d+\b/gi) || [];
  const entities = [...new Set([...amounts, ...dates, ...plates])];
  const expiryMatch = text.match(/\b(\d{2})\/(\d{4})\b/);
  const trimmed = text.trim();
  const firstSentence = trimmed.replace(/^[.!?\s]+/, '').split(/[.!?]/)[0]?.trim();
  const summary =
    req.type === 'photo'
      ? 'Photo capture (not extracted on this device)'
      : req.type === 'voice' && !trimmed
        ? 'Voice memo (audio stored on device)'
        : (firstSentence || trimmed.slice(0, 80)).slice(0, 80) || 'Untitled capture';
  return {
    extraction: {
      summary,
      entities,
      expiryDate: expiryMatch ? normalizeExpiryDate(`${expiryMatch[2]}-${expiryMatch[1]}`) : null,
    },
    source: 'SIMULATED',
    latencyMs: Math.round(performance.now() - started),
  };
}

/** ONE_ON_DEVICE extraction with schema-constrained JSON, per CSD §4.4. */
export async function extractCapture(req: ExtractionRequest): Promise<ExtractionResult> {
  const started = performance.now();
  // Per CSD ADR-03, Gemini Nano on-device accepts text and image only, not raw audio.
  if (req.type === 'voice' && !req.text?.trim()) {
    return simulatedExtraction(req);
  }
  const { ai } = getServices();
  if (!ai) return simulatedExtraction(req);

  try {
    const { getGenerativeModel, InferenceMode, InferenceSource: SdkInferenceSource, Schema } =
      await loadAiSdk();
    const expectedInputs: { type: 'text' | 'image'; languages?: string[] }[] = [
      { type: 'text', languages: ['en'] },
      ...(req.imageDataUrl ? [{ type: 'image' as const }] : []),
    ];
    const model: GenerativeModel = getGenerativeModel(ai, {
      mode: InferenceMode.ONLY_ON_DEVICE,
      onDeviceParams: {
        createOptions: {
          expectedInputs,
          initialPrompts: [
            { role: 'system', content: [{ type: 'text', value: ON_DEVICE_PROMPT_INSTRUCTIONS }] },
          ],
        },
        promptOptions: { responseConstraint: getExtractionJsonSchema(Schema) },
      },
    });

    const prompt =
      'Extract a one-line summary, a flat list of factual entities (names, amounts, dates, plates, passwords), and an explicitly stated expiry date (YYYY-MM) or null. Return JSON only.';
    const parts: unknown[] = req.imageDataUrl
      ? [prompt, dataUrlToPart(req.imageDataUrl)]
      : [`${prompt}\n\nCapture text:\n${req.text || ''}`];
    const result = await model.generateContent(parts as Parameters<GenerativeModel['generateContent']>[0]);
    const raw = result.response.text().trim();
    const parsed = JSON.parse(raw) as { summary?: string; entities?: string[]; expiryDate?: string | null };
    if (!parsed.summary || !Array.isArray(parsed.entities)) throw new Error('Invalid extraction schema');
    const sdkSource = (result.response as unknown as { inferenceSource?: unknown }).inferenceSource;
    return {
      extraction: {
        summary: parsed.summary,
        entities: parsed.entities.filter((e) => typeof e === 'string'),
        expiryDate: normalizeExpiryDate(parsed.expiryDate),
      },
      source: toSdkSource(sdkSource, SdkInferenceSource),
      latencyMs: Math.round(performance.now() - started),
    };
  } catch (error) {
    // No model substitution and no cloud fallback for originals: keep the
    // capture, store it unextracted (here with a minimal local derivation).
    const fallback = simulatedExtraction(req);
    return {
      ...fallback,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export type NanoAvailability = 'readily' | 'after-download' | 'downloading' | 'no' | 'unsupported';

function mapNanoAvailability(raw: unknown): NanoAvailability {
  if (raw === 'available' || raw === 'readily') return 'readily';
  if (raw === 'downloadable' || raw === 'after-download') return 'after-download';
  if (raw === 'downloading') return 'downloading';
  if (raw === 'unavailable' || raw === 'no') return 'no';
  return 'unsupported';
}

export async function probeNanoAvailability(): Promise<NanoAvailability> {
  const root = globalThis as unknown as {
    LanguageModel?: { availability?: (opts?: unknown) => Promise<string> };
    ai?: {
      languageModel?: {
        availability?: (opts?: unknown) => Promise<string>;
        capabilities?: () => Promise<{ available?: string }>;
      };
    };
  };
  try {
    if (typeof root.LanguageModel?.availability === 'function') {
      try {
        const status = await root.LanguageModel.availability({
          expectedInputs: [{ type: 'text', languages: ['en'] }],
        });
        return mapNanoAvailability(status);
      } catch {
        const status = await root.LanguageModel.availability();
        return mapNanoAvailability(status);
      }
    }
    if (typeof root.ai?.languageModel?.availability === 'function') {
      return mapNanoAvailability(await root.ai.languageModel.availability());
    }
    if (typeof root.ai?.languageModel?.capabilities === 'function') {
      const caps = await root.ai.languageModel.capabilities();
      return mapNanoAvailability(caps?.available);
    }
    return 'unsupported';
  } catch {
    return 'no';
  }
}

export async function initializeDeviceModel(onProgress?: (fraction: number) => void): Promise<boolean> {
  const { ai } = getServices();
  if (!ai) return false;
  try {
    const { getGenerativeModel, InferenceMode } = await loadAiSdk();
    const model = getGenerativeModel(ai, { mode: InferenceMode.PREFER_ON_DEVICE });
    await model.initializeDeviceModel((value: number) => onProgress?.(Math.min(1, value)));
    return true;
  } catch (error) {
    console.warn('[ai] on-device model unavailable', error);
    return false;
  }
}

const SENSITIVE_KEYWORD_RE =
  /\b(password|passcode|passphrase|pwd|mat\s*khau|otp|verification\s*code|ma\s*xac\s*thuc|pin\s*code|cvv|secret|api\s*key|token|wifi\s*key)\b/i;

const SENSITIVE_INLINE_RE =
  /\b(password|passcode|passphrase|pwd|mat\s*khau|otp|verification\s*code|ma\s*xac\s*thuc|pin\s*code|cvv|secret|token)\b(\s*(?:is|la|:|=)?\s*)([^\s,;]+)/gi;

const BENIGN_ENTITY_RE =
  /^(?:\d{2}\/\d{4}|\d{4}-\d{2}|[\d.,]+\s*(?:vnd|₫|k)|\d{2}[a-z]-?\d+\.\d+|wifi|password|mat khau|receipt|medicine)$/i;

export function isSensitiveEntity(
  value: string,
  capture?: Pick<CaptureRecord, 'summary' | 'derivedText'>,
): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (SENSITIVE_KEYWORD_RE.test(trimmed)) return true;
  if (BENIGN_ENTITY_RE.test(normalize(trimmed))) return false;
  const captureText = normalize(`${capture?.summary || ''} ${capture?.derivedText || ''}`);
  if (SENSITIVE_KEYWORD_RE.test(captureText)) {
    return /^[a-z0-9!@#$%^&*_.-]{4,}$/i.test(trimmed) || /^\d{4,8}$/.test(trimmed);
  }
  return false;
}

export function hasSensitiveEntities(captures: CaptureRecord[]): boolean {
  return captures.some((c) => c.entities.some((e) => isSensitiveEntity(e, c)));
}

export function redactSensitiveText(text: string): string {
  return text.replace(SENSITIVE_INLINE_RE, '$1$2[REDACTED]');
}

function contextFrom(
  captures: CaptureRecord[],
  allowSensitiveCloud = false,
  includeTags = false,
): string {
  return captures
    .map((c) => {
      const summary = allowSensitiveCloud ? c.summary : redactSensitiveText(c.summary);
      const entities = c.entities.map((e) =>
        allowSensitiveCloud || !isSensitiveEntity(e, c) ? e : '[REDACTED]',
      );
      // User tags are only ever shown to the on-device model; they never go to the cloud.
      const tagLine = includeTags && c.tags?.length ? `\n  tags: ${c.tags.join(', ')}` : '';
      return `- [${c.id}] ${c.type} ${c.capturedAt}\n  summary: ${summary}\n  entities: ${entities.join(', ')}${tagLine}\n  expiryDate: ${captureExpiry(c) ?? 'none'}`;
    })
    .join('\n');
}

export function citeSummary(capture: CaptureRecord): string {
  const trimmed = capture.summary.trim();
  if (!trimmed) return '';
  return trimmed
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => {
      const clean = sentence.trim();
      if (!clean) return '';
      const punct = clean.match(/([.!?]+)$/)?.[1]?.[0] || '.';
      const body = clean.replace(/[.!?]+$/, '').trim();
      return body ? `${body} [${capture.id}]${punct}` : '';
    })
    .filter(Boolean)
    .join(' ');
}

function simulatedAnswer(question: string, captures: CaptureRecord[], intent: 'short' | 'long'): string {
  if (!captures.length) return 'NOT_FOUND';
  const q = normalize(question);
  const top = captures[0];
  if (/expir|han dung|het han/i.test(q)) {
    const withExpiry = captures.find((c) => Boolean(captureExpiry(c)));
    if (withExpiry) {
      const numeric = expiryNumeric(captureExpiry(withExpiry));
      return `In ${numeric} [${withExpiry.id}].`;
    }
    return 'NOT_FOUND';
  }
  if (/\bplate|bien so/.test(q)) {
    const plate = top.entities.find((e) => /\d{2}[A-Z]-?\d+\.\d+/i.test(e));
    if (plate) return `The plate is ${plate} [${top.id}].`;
    return citeSummary(top) || 'NOT_FOUND';
  }
  if (/\bpassword|wifi|mat khau/.test(q)) {
    return citeSummary(top) || 'NOT_FOUND';
  }
  if (intent === 'long') {
    return captures.map(citeSummary).filter(Boolean).join(' ') || 'NOT_FOUND';
  }
  return citeSummary(top) || 'NOT_FOUND';
}

const SHORT_ON_DEVICE_TIMEOUT_MS = 8_000;
const LONG_CLOUD_TIMEOUT_MS = 12_000;

export function withTimeout<T>(promise: Promise<T>, ms: number, label = 'AI call'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, deadline]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/** A second model attempt only helps for transient failures. Auth, App Check,
 * permission, quota and connectivity errors would fail again, so they degrade
 * straight to the labelled local fallback. */
export function isTransientAiError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (/403|401|permission|app.?check|unauthori[sz]ed|forbidden|quota|429|offline|network|failed to fetch|timed out|not.?found.*model|api key/.test(message)) {
    return false;
  }
  return /500|502|503|504|unavailable|overloaded|internal|model/.test(message);
}

function localAnswer(
  question: string,
  captures: CaptureRecord[],
  intent: 'short' | 'long',
  started: number,
  error?: string,
): Omit<AnswerResult, 'claims' | 'sources' | 'notFound'> {
  return {
    text: simulatedAnswer(question, captures, intent),
    inferenceSource: 'SIMULATED',
    latencyMs: Math.round(performance.now() - started),
    intent,
    ...(error ? { error: error.slice(0, 200) } : {}),
  };
}

/**
 * Short questions never leave the device: the answer is a deterministic local
 * lookup, optionally phrased by Gemini Nano (`ONLY_ON_DEVICE`) when Nano is
 * ready. Only long cross-capture synthesis (`ONLY_IN_CLOUD`) may use the cloud,
 * and it receives summaries only — never tags, originals or embeddings.
 */
export async function answerQuestion(
  question: string,
  captures: CaptureRecord[],
  intent: 'short' | 'long',
  options?: { allowSensitiveCloud?: boolean },
): Promise<Omit<AnswerResult, 'claims' | 'sources' | 'notFound'>> {
  const started = performance.now();
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (intent === 'long' && offline) {
    return {
      text: 'OFFLINE_SYNTHESIS_REQUIRES_CONNECTION',
      inferenceSource: 'SIMULATED',
      latencyMs: Math.round(performance.now() - started),
      intent,
      error: 'OFFLINE_SYNTHESIS_REQUIRES_CONNECTION',
    };
  }
  const { ai } = getServices();
  if (!ai) return localAnswer(question, captures, intent, started);

  // Short intent: skip the model entirely unless Nano is ready on this device.
  if (intent === 'short' && (await probeNanoAvailability()) !== 'readily') {
    return localAnswer(question, captures, intent, started);
  }

  try {
    const { getGenerativeModel, InferenceMode, InferenceSource: SdkInferenceSource } = await loadAiSdk();
    const mode = intent === 'long' ? InferenceMode.ONLY_IN_CLOUD : InferenceMode.ONLY_ON_DEVICE;
    const buildModel = (cloudModel: string) =>
      getGenerativeModel(ai, {
        mode,
        ...(mode === InferenceMode.ONLY_IN_CLOUD ? { inCloudParams: { model: cloudModel } } : {}),
        ...(mode === InferenceMode.ONLY_ON_DEVICE
          ? {
              onDeviceParams: {
                createOptions: { expectedInputs: [{ type: 'text', languages: ['en'] }] },
              },
            }
          : {}),
      });
    const prompt = [
      'Answer the question using ONLY the numbered captures below.',
      'Cite every factual claim inline with its capture id in square brackets, e.g. [cap_123].',
      'If the captures do not support an answer, reply exactly NOT_FOUND.',
      'Never give advice or infer values that are not present.',
      '',
      `Question: ${question}`,
      '',
      'Captures:',
      contextFrom(captures, options?.allowSensitiveCloud ?? false, intent === 'short'),
    ].join('\n');
    const timeoutMs = intent === 'long' ? LONG_CLOUD_TIMEOUT_MS : SHORT_ON_DEVICE_TIMEOUT_MS;
    let model: GenerativeModel = buildModel(settings.cloudModel);
    let result;
    try {
      result = await withTimeout(model.generateContent(prompt), timeoutMs, 'Answer generation');
    } catch (primaryError) {
      // Only long cloud synthesis has a fallback model, and only transient
      // failures are worth a second attempt.
      if (
        intent !== 'long' ||
        settings.cloudModel === FALLBACK_CLOUD_MODEL ||
        !isTransientAiError(primaryError)
      ) {
        throw primaryError;
      }
      console.warn('[ai] primary cloud model failed; retrying with fallback', primaryError);
      model = buildModel(FALLBACK_CLOUD_MODEL);
      result = await withTimeout(model.generateContent(prompt), timeoutMs, 'Fallback generation');
    }
    const sdkSource = (result.response as unknown as { inferenceSource?: unknown }).inferenceSource;
    const source = toSdkSource(sdkSource, SdkInferenceSource);
    return {
      text: result.response.text().trim(),
      inferenceSource: source,
      latencyMs: Math.round(performance.now() - started),
      intent,
    };
  } catch (error) {
    // A failed live call degrades to the deterministic local fallback, but the
    // reason is surfaced so the failure is never hidden behind a plausible answer.
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[ai] live answer failed; using local fallback', message);
    if (intent === 'long' && typeof navigator !== 'undefined' && navigator.onLine === false) {
      return {
        text: 'OFFLINE_SYNTHESIS_REQUIRES_CONNECTION',
        inferenceSource: 'SIMULATED',
        latencyMs: Math.round(performance.now() - started),
        intent,
        error: 'OFFLINE_SYNTHESIS_REQUIRES_CONNECTION',
      };
    }
    return localAnswer(question, captures, intent, started, message);
  }
}
