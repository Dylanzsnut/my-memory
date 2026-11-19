import type { CaptureRecord, SearchResult } from '../types';
import { STOPWORDS, SYNONYMS, contentWords, cosine, embed, normalize, rawWords, tokenize } from './embeddings';

function lexicalScore(query: string, capture: CaptureRecord): number {
  const qWords = contentWords(query);
  if (!qWords.length) return 0;
  const captureWords = rawWords(
    [capture.summary, capture.entities.join(' '), (capture.tags || []).join(' '), capture.derivedText || ''].join(' '),
  );
  const captureWordSet = new Set(captureWords);
  let matched = 0;
  for (const word of qWords) {
    const singular = word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word;
    const directHit =
      captureWordSet.has(word) ||
      captureWordSet.has(singular) ||
      (word.length >= 3 && captureWords.some((cw) => cw.startsWith(word)));
    if (directHit) {
      matched += 1;
      continue;
    }
    const syns = SYNONYMS[word] || [];
    if (syns.some((syn) => captureWordSet.has(syn))) {
      matched += 0.85;
    }
  }
  return matched / qWords.length;
}

function questionWords(query: string): string[] {
  return rawWords(query).filter((w) => !STOPWORDS.has(w));
}

function sameWordSet(a: string[], b: string[]): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  return sa.size > 0 && sa.size === sb.size && [...sa].every((w) => sb.has(w));
}

/**
 * Returns the user tag a question is browsing, or null. A tag-browse question
 * is one whose meaningful words are exactly the tag ("What do I have about
 * Casanos?", "#Casanos", "casanos"). It is answered by a local lookup, never a
 * model call.
 */
export function tagBrowseTarget(query: string, tags: string[]): string | null {
  const qWords = questionWords(query);
  if (!qWords.length) return null;
  let best: string | null = null;
  for (const tag of tags) {
    if (sameWordSet(qWords, rawWords(tag)) && (!best || tag.length > best.length)) best = tag;
  }
  return best;
}

export async function searchCaptures(
  query: string,
  captures: CaptureRecord[],
  threshold: number,
): Promise<SearchResult[]> {
  const active = captures.filter((c) => c.retentionState !== 'trashed');
  const queryVector = await embed(query || 'everything');
  const qTokens = tokenize(query).filter((t) => !t.includes('_'));
  const qMeaningful = questionWords(query);
  const results = await Promise.all(
    active.map(async (capture) => {
      const vectorSource =
        capture.embedding.length === queryVector.length
          ? capture.embedding
          : await embed(
              [capture.summary, capture.entities.join(' '), (capture.tags || []).join(' '), capture.derivedText || '']
                .filter(Boolean)
                .join(' '),
            );
      const vector = cosine(queryVector, vectorSource);
      const lexical = lexicalScore(query, capture);
      const tagMatch = (capture.tags || []).some((tag) => {
        const normTag = normalize(tag);
        return qTokens.some((tok) => tok.length >= 2 && (normTag === tok || normTag.includes(tok)));
      });
      const exactTag = (capture.tags || []).some((tag) => sameWordSet(qMeaningful, rawWords(tag)));
      // A strong word/synonym hit may carry a capture on its own, so a bill can
      // answer "receipt" even when the hashed vectors are far apart.
      const baseScore = query.trim()
        ? Math.max(0.65 * Math.max(0, vector) + 0.35 * lexical, 0.9 * lexical)
        : 0.5;
      const tagBoost = exactTag ? 0.3 : tagMatch ? 0.08 : 0;
      const score = query.trim() ? Math.min(1, baseScore + tagBoost) : baseScore;
      return { capture, score };
    }),
  );
  return results
    .filter((r) => !query.trim() || r.score >= threshold)
    .sort((a, b) => b.score - a.score);
}

export function isLongSynthesisQuestion(query: string): boolean {
  const q = normalize(query);
  return /total|sum |summar|interact|compare|all (my|the)|this month|across|combine|tong hop|tong cong|tong chi/.test(q);
}
