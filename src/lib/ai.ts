import {
  getGenerativeModel,
  InferenceMode,
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
import { settings, ON_DEVICE_PROMPT_INSTRUCTIONS } from './config';
import { normalize } from './embeddings';

const extractionSchema = Schema.object({
  properties: {
    summary: Schema.string(),
    entities: Schema.array({ items: Schema.string() }),
    expiryDate: Schema.string(),
  },
  optionalProperties: ['expiryDate'],
});

function toSdkSource(source: unknown): InferenceSource {
  return source === 'IN_CLOUD' ? 'IN_CLOUD' : 'ON_DEVICE';
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
  const summary =
    req.type === 'photo'
      ? 'Photo capture (not extracted on this device)'
      : text.split(/[.!?]/)[0].slice(0, 80) || 'Untitled capture';
  return {
    extraction: { summary, entities, expiryDate: expiryMatch ? `${expiryMatch[2]}-${expiryMatch[1]}` : null },
    source: 'SIMULATED',
    latencyMs: Math.round(performance.now() - started),
  };
}

/** ONE_ON_DEVICE extraction with schema-constrained JSON, per CSD §4.4. */
export async function extractCapture(req: ExtractionRequest): Promise<ExtractionResult> {
  const started = performance.now();
  const { ai } = getServices();
  if (!ai) return simulatedExtraction(req);

  try {
    const model: GenerativeModel = getGenerativeModel(ai, {
      mode: InferenceMode.ONLY_ON_DEVICE,
      onDeviceParams: {
        createOptions: {
          expectedInputs: [
            { type: 'text', languages: ['en'] },
            { type: 'image' },
          ],
          initialPrompts: [
            { role: 'system', content: [{ type: 'text', value: ON_DEVICE_PROMPT_INSTRUCTIONS }] },
          ],
        },
        promptOptions: { responseConstraint: extractionSchema },
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
    return {
      extraction: {
        summary: parsed.summary,
        entities: parsed.entities.filter((e) => typeof e === 'string'),
        expiryDate: typeof parsed.expiryDate === 'string' ? parsed.expiryDate : null,
      },
      source: 'ON_DEVICE',
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

function simulatedAnswer(question: string, captures: CaptureRecord[], intent: 'short' | 'long'): string {
  if (!captures.length) return 'NOT_FOUND';
  const q = normalize(question);
  const top = captures[0];
  if (/\bexpire|expiry|han dung|het han/.test(q) && top.expiryDate) {
    const [year, month] = top.expiryDate.split('-');
    return `In ${month}/${year}. This comes from the capture [${top.id}]${top.entities.includes('medicine') ? ' — the medicine box photographed earlier' : ''}.`;
  }
  if (/\bplate|bien so/.test(q)) {
    const plate = top.entities.find((e) => /\d{2}[A-Z]-?\d+\.\d+/i.test(e)) || top.summary;
    return `The plate is ${plate}. Source: [${top.id}].`;
  }
  if (/\bpassword|wifi|mat khau/.test(q)) {
    return `${top.summary}. Source: [${top.id}].`;
  }
  if (intent === 'long') {
    return captures
      .map((c) => `${c.summary.replace(/[.!?]$/, '')} [${c.id}]`)
      .join('; ') + '.';
  }
  return `${top.summary}. Source: [${top.id}].`;
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
    const model = getGenerativeModel(ai, {
      mode,
      ...(intent === 'long'
        ? { inCloudParams: { model: settings.cloudModel } }
        : {
            onDeviceParams: {
              createOptions: { expectedInputs: [{ type: 'text', languages: ['en'] }] },
            },
          }),
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
      contextFrom(captures),
    ].join('\n');
    const result = await model.generateContent(prompt);
    const sdkSource = (result.response as unknown as { inferenceSource?: unknown }).inferenceSource;
    const source = intent === 'long' ? 'IN_CLOUD' : toSdkSource(sdkSource);
    return {
      text: result.response.text().trim(),
      inferenceSource: source,
      latencyMs: Math.round(performance.now() - started),
      intent,
    };
  } catch (error) {
    return {
      text: simulatedAnswer(question, captures, intent),
      inferenceSource: 'SIMULATED',
      latencyMs: Math.round(performance.now() - started),
      intent,
    };
  }
}
