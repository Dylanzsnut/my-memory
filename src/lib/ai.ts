import {
  getGenerativeModel,
  InferenceMode,
  InferenceSource as SdkInferenceSource,
  Schema,
  type GenerativeModel,
} from 'firebase/ai';
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

const extractionSchema = Schema.object({
  properties: {
    summary: Schema.string(),
    entities: Schema.array({ items: Schema.string() }),
    expiryDate: Schema.string({ nullable: true }),
  },
  optionalProperties: ['expiryDate'],
});

const extractionJsonSchema = JSON.parse(JSON.stringify(extractionSchema)) as object;

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

function toSdkSource(source: unknown): InferenceSource {
  // The SDK reports lowercase values ('in_cloud' / 'on_device'), not the
  // uppercase labels used by this app's UI and data model.
  if (source === SdkInferenceSource.IN_CLOUD || source === 'IN_CLOUD') return 'IN_CLOUD';
  if (source === SdkInferenceSource.ON_DEVICE || source === 'ON_DEVICE') return 'ON_DEVICE';
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
        promptOptions: { responseConstraint: extractionJsonSchema },
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
      source: toSdkSource(sdkSource),
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
    const model = getGenerativeModel(ai, { mode: InferenceMode.PREFER_ON_DEVICE });
    await model.initializeDeviceModel((value: number) => onProgress?.(Math.min(1, value)));
    return true;
  } catch (error) {
    console.warn('[ai] on-device model unavailable', error);
    return false;
  }
}

function contextFrom(captures: CaptureRecord[]): string {
  return captures
    .map(
      (c) =>
        `- [${c.id}] ${c.type} ${c.capturedAt}\n  summary: ${c.summary}\n  entities: ${c.entities.join(', ')}\n  expiryDate: ${c.expiryDate ?? 'null'}`,
    )
    .join('\n');
}

function citeSummary(capture: CaptureRecord): string {
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
    const withExpiry = captures.find((c) => Boolean(c.expiryDate)) ?? top;
    if (withExpiry.expiryDate) {
      const parts = withExpiry.expiryDate.split('-');
      const expiryLabel =
        parts.length >= 3
          ? `${parts[2]}/${parts[1]}/${parts[0]}`
          : parts.length === 2
            ? `${parts[1]}/${parts[0]}`
            : withExpiry.expiryDate;
      const prefix = parts.length >= 3 ? `On ${expiryLabel}` : `In ${expiryLabel}`;
      const detail = withExpiry.entities.includes('medicine') ? ' — from the medicine box photographed earlier' : '';
      return `${prefix} [${withExpiry.id}]${detail}.`;
    }
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

export async function answerQuestion(
  question: string,
  captures: CaptureRecord[],
  intent: 'short' | 'long',
): Promise<Omit<AnswerResult, 'claims' | 'sources' | 'notFound'>> {
  const started = performance.now();
  const { ai } = getServices();
  if (!ai) {
    return {
      text: simulatedAnswer(question, captures, intent),
      inferenceSource: 'SIMULATED',
      latencyMs: Math.round(performance.now() - started),
      intent,
    };
  }

  try {
    const mode = intent === 'long' ? InferenceMode.ONLY_IN_CLOUD : InferenceMode.PREFER_ON_DEVICE;
    const cloudModelName = settings.cloudModel;
    const buildModel = (cloudModel: string) =>
      getGenerativeModel(ai, {
        mode,
        inCloudParams: { model: cloudModel },
        ...(mode === InferenceMode.PREFER_ON_DEVICE
          ? {
              onDeviceParams: {
                createOptions: { expectedInputs: [{ type: 'text', languages: ['en'] }] },
              },
            }
          : {}),
      });
    let model: GenerativeModel = buildModel(cloudModelName);
    const prompt = [
      'Answer the question using ONLY the numbered captures below.',
      'Cite every factual claim inline with its capture id in square brackets, e.g. [cap_123].',
      'If the captures do not support an answer, reply exactly NOT_FOUND.',
      'Never give advice or infer values that are not present.',
      '',
      `Question: ${question}`,
      '',
      'Captures:',
      contextFrom(captures),
    ].join('\n');
    let result;
    try {
      result = await model.generateContent(prompt);
    } catch (primaryError) {
      // Retry once with the documented fallback cloud model before degrading
      // to the local simulated answer.
      if (cloudModelName === FALLBACK_CLOUD_MODEL) throw primaryError;
      console.warn('[ai] primary cloud model failed; retrying with fallback', primaryError);
      model = buildModel(FALLBACK_CLOUD_MODEL);
      result = await model.generateContent(prompt);
    }
    const sdkSource = (result.response as unknown as { inferenceSource?: unknown }).inferenceSource;
    const source = toSdkSource(sdkSource);
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
    return {
      text: simulatedAnswer(question, captures, intent),
      inferenceSource: 'SIMULATED',
      latencyMs: Math.round(performance.now() - started),
      intent,
      error: message.slice(0, 200),
    };
  }
}
