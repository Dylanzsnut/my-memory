import type { CaptureRecord, SearchResult } from '../types';
import { cosine, embed, normalize, tokenize } from './embeddings';

function lexicalScore(query: string, capture: CaptureRecord): number {
  const qTokens = tokenize(query).filter((t) => !t.includes('_'));
  if (!qTokens.length) return 0;
  const haystack = normalize(
    [capture.summary, capture.entities.join(' '), capture.derivedText || ''].join(' '),
  );
  const hits = qTokens.filter((token) => haystack.includes(token)).length;
  return hits / qTokens.length;
}

export async function searchCaptures(
  query: string,
  captures: CaptureRecord[],
  threshold: number,
): Promise<SearchResult[]> {
  const active = captures.filter((c) => c.retentionState !== 'trashed');
  const queryVector = await embed(query || 'everything');
  const results = active.map((capture) => {
    const vector = cosine(queryVector, capture.embedding);
    const lexical = lexicalScore(query, capture);
    const score = query.trim() ? 0.65 * Math.max(0, vector) + 0.35 * lexical : 0.5;
    return { capture, score };
  });
  return results
    .filter((r) => !query.trim() || r.score >= threshold)
    .sort((a, b) => b.score - a.score);
}

export function isLongSynthesisQuestion(query: string): boolean {
  const q = normalize(query);
  return /total|sum |summar|interact|compare|all (my|the)|this month|across|combine|tong hop|tong cong|tong chi/.test(q);
}
