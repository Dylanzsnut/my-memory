import type { CaptureRecord, Language } from '../types';
import { contentWords } from './embeddings';
import { isTagSecret } from './tags';

/** Questions generated from the local library — no model call, no network. */
export interface Suggestion {
  question: string;
  captureId?: string;
}

const CATEGORY = new Set([
  'password', 'passcode', 'passphrase', 'pwd', 'mat khau', 'otp', 'wifi', 'wifi key',
  'receipt', 'bill', 'invoice', 'medicine', 'medication', 'pill', 'note', 'memo',
]);

function topicWords(capture: CaptureRecord): string[] {
  const raw = [capture.summary, ...(capture.entities || []), ...(capture.tags || [])].join(' ');
  return contentWords(raw)
    .filter((word) => !CATEGORY.has(word) && !isTagSecret(word, capture) && word.length > 2)
    .slice(0, 3);
}

function shortTitle(capture: CaptureRecord, language: Language): string {
  const words = topicWords(capture);
  if (words.length) return words.slice(0, 2).join(' ');
  return capture.summary.trim().split(/[.!?]/)[0].slice(0, 32) || (language === 'vi' ? 'ký ức này' : 'this memory');
}

/** Build at most 5 relevant, answerable questions from the given captures. */
export function suggestQuestions(
  captures: CaptureRecord[],
  language: Language,
  online = false,
): Suggestion[] {
  const active = captures.filter((capture) => capture.retentionState !== 'trashed');
  if (!active.length) return [];
  const sorted = [...active].sort(
    (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
  );
  const candidates: Suggestion[] = [];
  const seen = new Set<string>();

  const add = (question: string, captureId?: string) => {
    const key = question.toLocaleLowerCase();
    if (!question.trim() || seen.has(key)) return;
    seen.add(key);
    candidates.push({ question, captureId });
  };

  const expiry = sorted.find((capture) => capture.expiryDate);
  if (expiry) {
    add(
      language === 'vi'
        ? `Hạn dùng của ${shortTitle(expiry, language)} là khi nào?`
        : `When does ${shortTitle(expiry, language)} expire?`,
      expiry.id,
    );
  }

  const amount = sorted.find((capture) =>
    /receipt|bill|invoice|hoa don|thanh toan|\bvnd\b|₫/i.test(
      `${capture.summary} ${(capture.entities || []).join(' ')} ${capture.derivedText || ''}`,
    ),
  );
  if (amount) {
    add(
      language === 'vi'
        ? `Tổng tiền ${shortTitle(amount, language)} là bao nhiêu?`
        : `How much was ${shortTitle(amount, language)}?`,
      amount.id,
    );
  }

  const credential = sorted.find((capture) =>
    /password|passcode|wifi|mat khau|otp|code/i.test(
      `${capture.summary} ${capture.derivedText || ''}`,
    ),
  );
  if (credential) {
    const topic = topicWords(credential)[0] || (language === 'vi' ? 'wifi' : 'wifi');
    add(
      language === 'vi'
        ? `Mật khẩu ${topic} là gì?`
        : `What's the ${topic} password?`,
      credential.id,
    );
  }

  const voice = sorted.find((capture) => capture.type === 'voice' && topicWords(capture).length);
  if (voice) {
    add(
      language === 'vi'
        ? `Tôi đã nói gì về ${topicWords(voice)[0]}?`
        : `What did I say about ${topicWords(voice)[0]}?`,
      voice.id,
    );
  }

  // A tag total only makes sense online (synthesis needs cloud help).
  if (online) {
    const tagCount = new Map<string, number>();
    active.forEach((capture) => (capture.tags || []).forEach((tag) => tagCount.set(tag, (tagCount.get(tag) || 0) + 1)));
    const busyTag = Array.from(tagCount.entries()).sort((a, b) => b[1] - a[1])[0];
    if (busyTag && busyTag[1] >= 2) {
      add(
        language === 'vi'
          ? `Tổng chi phí #${busyTag[0]} của tôi?`
          : `Total my #${busyTag[0]} spending?`,
      );
    }
  }

  for (const capture of sorted) {
    if (candidates.length >= 5) break;
    const words = topicWords(capture);
    if (!words.length) continue;
    add(
      language === 'vi'
        ? `Tôi đã lưu gì về ${words[0]}?`
        : `What did I save about ${words[0]}?`,
      capture.id,
    );
  }

  return candidates.slice(0, 5);
}
