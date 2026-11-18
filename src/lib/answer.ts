import type { AnswerResult, CaptureRecord, Claim } from '../types';
import { answerQuestion } from './ai';
import { isLongSynthesisQuestion, searchCaptures } from './search';

function normalizeNumber(text: string): string[] {
  return (text.match(/\d{1,4}(?:[.,]\d+)?|\d{2}\/\d{4}/g) || []).map((n) =>
    n.replace(/[.,]/g, ''),
  );
}

/** Fail-closed: a claim is shown only if every number in it appears in the cited capture. */
function verifyClaim(sentence: string, capture: CaptureRecord): boolean {
  const clean = sentence.replace(/\[cap_[^\]]+\]/g, '').trim();
  if (!clean.replace(/[\s.,!?;:]+/g, '')) return false;
  const numbers = normalizeNumber(clean);
  if (!numbers.length) return true;
  const source = [capture.summary, capture.entities.join(' '), capture.expiryDate || '', capture.derivedText || '']
    .join(' ')
    .replace(/[.,]/g, '');
  return numbers.every((number) => source.includes(number));
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

export async function buildAnswer(
  question: string,
  captures: CaptureRecord[],
  threshold: number,
): Promise<AnswerResult> {
  const intent = isLongSynthesisQuestion(question) ? 'long' : 'short';
  const results = await searchCaptures(question, captures, threshold);
  if (!results.length || !question.trim()) {
    return {
      text: 'Not found in memory. No capture supports an answer to that question.',
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
  const generated = await answerQuestion(question, sources, intent);
  const claims = generated.text === 'NOT_FOUND' ? [] : parseClaims(generated.text, sources);
  const verified = claims.filter((c) => c.verified);
  const notFound = generated.text === 'NOT_FOUND' || verified.length === 0;
  if (notFound) {
    return {
      text: 'Not found in memory. No capture supports an answer to that question.',
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
      .join(' ') || 'Not found in memory.';
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
