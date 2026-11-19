import type { AnswerResult, CaptureRecord, Claim, Language } from '../types';
import { answerQuestion, citeSummary, hasSensitiveEntities } from './ai';
import { contentWords, normalize, rawWords, tokenize } from './embeddings';
import { t } from './i18n';
import { isLongSynthesisQuestion, searchCaptures } from './search';

export function extractNumberTokens(text: string): string[] {
  const matches = text.match(/\d+(?:[.,/:-]\d+)*/g) || [];
  const tokens: string[] = [];
  for (const raw of matches) {
    const ym = raw.match(/^(\d{4})-(\d{2})$/);
    if (ym) {
      tokens.push(`ym:${ym[1]}-${ym[2]}`);
      continue;
    }
    const my = raw.match(/^(\d{2})\/(\d{4})$/);
    if (my) {
      tokens.push(`ym:${my[2]}-${my[1]}`);
      continue;
    }
    const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) {
      tokens.push(`ymd:${ymd[1]}-${ymd[2]}-${ymd[3]}`);
      continue;
    }
    const dmy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (dmy) {
      tokens.push(`ymd:${dmy[3]}-${dmy[2]}-${dmy[1]}`);
      continue;
    }
    if (/^\d{1,3}(?:[.,]\d{3})+$/.test(raw)) {
      tokens.push(raw.replace(/[.,]/g, ''));
      continue;
    }
    tokens.push(raw.replace(/,/g, '.'));
  }
  return tokens;
}

/**
 * Fail-closed claim verification:
 * 1. Every numeric token must appear verbatim as a whole number/date token in the capture.
 * 2. Every alphanumeric code token (containing both letters and digits) must appear in the capture.
 * 3. At least one domain/entity token or number from the claim must match the capture.
 */
export function verifyClaim(sentence: string, capture: CaptureRecord): boolean {
  const clean = sentence.replace(/\[cap_[^\]]+\]/g, '').trim();
  if (!clean.replace(/[\s.,!?;:]+/g, '')) return false;

  const sourceText = [
    capture.summary,
    capture.entities.join(' '),
    capture.expiryDate || '',
    capture.derivedText || '',
    ...(capture.tags || []),
  ].join(' ');

  const claimNumbers = extractNumberTokens(clean);
  const captureNumbers = new Set(extractNumberTokens(sourceText));
  if (!claimNumbers.every((number) => captureNumbers.has(number))) {
    return false;
  }

  const captureWordSet = new Set(rawWords(sourceText));
  const captureTokens = new Set(tokenize(sourceText).filter((tok) => !tok.includes('_')));

  const alphanumericCodes = rawWords(clean).filter((w) => /[a-z]/i.test(w) && /\d/.test(w));
  if (!alphanumericCodes.every((code) => captureWordSet.has(code) || captureTokens.has(code))) {
    return false;
  }

  const nonNumericClaimWords = contentWords(clean).filter((w) => !/^\d+$/.test(w));
  const hasTokenOverlap = nonNumericClaimWords.some((word) =>
    tokenize(word)
      .filter((tok) => !tok.includes('_'))
      .some((tok) => captureTokens.has(tok)),
  );

  if (nonNumericClaimWords.length > 0 && !hasTokenOverlap) {
    return false;
  }

  return claimNumbers.length > 0 || hasTokenOverlap;
}

function parseClaims(text: string, sources: CaptureRecord[]): Claim[] {
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const claims: Claim[] = [];
  for (const sentence of sentences) {
    const ids = [...sentence.matchAll(/\[(cap_[^\]]+)\]/g)].map((m) => m[1]);
    const cited = ids.map((id) => sources.find((s) => s.id === id)).filter(Boolean) as CaptureRecord[];
    if (!cited.length) continue;
    const verified = cited.every((capture) => verifyClaim(sentence, capture));
    claims.push({ text: sentence, captureId: cited[0].id, verified });
  }
  return claims;
}

export interface BuildAnswerOptions {
  language?: Language;
  allowSensitiveCloud?: boolean;
  onSensitiveCloudConfirm?: (captures: CaptureRecord[]) => Promise<boolean>;
  /** Tag being browsed (see `tagBrowseTarget`). Answered locally with no model call. */
  browseTag?: string;
}

const BROWSE_LIMIT = 10;

/** Deterministic local answer for a tag-browse question: every capture that
 * carries the tag, cited and verified like any other answer. */
function buildTagBrowseAnswer(
  tag: string,
  captures: CaptureRecord[],
  language: Language,
): AnswerResult {
  const started = performance.now();
  const normTag = normalize(tag);
  const tagged = captures
    .filter(
      (c) => c.retentionState !== 'trashed' && (c.tags || []).some((item) => normalize(item) === normTag),
    )
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
    .slice(0, BROWSE_LIMIT)
    .map((c) => ({ ...c, sourceMatch: { score: 1, captureId: c.id } }));
  const notFoundResult = (): AnswerResult => ({
    text: t(language, 'notFoundMessage'),
    claims: [],
    sources: [],
    inferenceSource: 'SIMULATED',
    latencyMs: Math.round(performance.now() - started),
    intent: 'short',
    notFound: true,
  });
  if (!tagged.length) return notFoundResult();
  const claims = parseClaims(tagged.map(citeSummary).filter(Boolean).join(' '), tagged).filter(
    (c) => c.verified,
  );
  if (!claims.length) return notFoundResult();
  const text = claims
    .map((c) =>
      c.text
        .replace(/\[cap_[^\]]+\]/g, '')
        .replace(/\s+([.,!?;:])/g, '$1')
        .replace(/\s{2,}/g, ' ')
        .trim(),
    )
    .filter(Boolean)
    .join(' ');
  const citedIds = new Set(claims.map((c) => c.captureId));
  return {
    text,
    claims,
    sources: tagged.filter((c) => citedIds.has(c.id)),
    inferenceSource: 'SIMULATED',
    latencyMs: Math.round(performance.now() - started),
    intent: 'short',
    notFound: false,
  };
}

export async function buildAnswer(
  question: string,
  captures: CaptureRecord[],
  threshold: number,
  options?: BuildAnswerOptions,
): Promise<AnswerResult> {
  const language = options?.language || 'en';
  if (options?.browseTag) return buildTagBrowseAnswer(options.browseTag, captures, language);
  const intent = isLongSynthesisQuestion(question) ? 'long' : 'short';
  const results = await searchCaptures(question, captures, threshold);
  if (!results.length || !question.trim()) {
    return {
      text: t(language, 'notFoundMessage'),
      claims: [],
      sources: [],
      inferenceSource: 'SIMULATED',
      latencyMs: 0,
      intent,
      notFound: true,
    };
  }
  const sources = results.slice(0, 5).map((r) => ({
    ...r.capture,
    sourceMatch: { score: r.score, captureId: r.capture.id },
  }));

  let allowSensitiveCloud = options?.allowSensitiveCloud ?? false;
  if (
    options?.allowSensitiveCloud === undefined &&
    options?.onSensitiveCloudConfirm &&
    hasSensitiveEntities(sources)
  ) {
    allowSensitiveCloud = await options.onSensitiveCloudConfirm(sources);
  }

  const generated = await answerQuestion(question, sources, intent, { allowSensitiveCloud });
  if (generated.error === 'OFFLINE_SYNTHESIS_REQUIRES_CONNECTION') {
    return {
      text: t(language, 'offlineSynthesisRequired'),
      claims: [],
      sources: [],
      inferenceSource: generated.inferenceSource,
      latencyMs: generated.latencyMs,
      intent,
      notFound: true,
      error: generated.error,
    };
  }

  const claims = generated.text === 'NOT_FOUND' ? [] : parseClaims(generated.text, sources);
  const verified = claims.filter((c) => c.verified);
  const notFound = generated.text === 'NOT_FOUND' || verified.length === 0;
  if (notFound) {
    return {
      text: t(language, 'notFoundMessage'),
      claims: [],
      sources: [],
      inferenceSource: generated.inferenceSource,
      latencyMs: generated.latencyMs,
      intent,
      notFound: true,
      ...(generated.error ? { error: generated.error } : {}),
    };
  }
  const text =
    verified
      .map((c) =>
        c.text
          .replace(/\[cap_[^\]]+\]/g, '')
          .replace(/\s+([.,!?;:])/g, '$1')
          .replace(/\s{2,}/g, ' ')
          .trim(),
      )
      .filter(Boolean)
      .join(' ') || t(language, 'notFoundMessage');
  return {
    text,
    claims: verified,
    sources: Array.from(new Map(verified.map((c) => [c.captureId, sources.find((s) => s.id === c.captureId)!])).values()),
    inferenceSource: generated.inferenceSource,
    latencyMs: generated.latencyMs,
    intent,
    notFound: false,
    ...(generated.error ? { error: generated.error } : {}),
  };
}
