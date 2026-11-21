import { useEffect, useState } from 'react';
import type { CaptureRecord, Language } from '../types';
import { isSensitiveEntity } from './ai';
import { redactSensitiveText } from './ai';
import { suggestQuestions } from './askSuggestions';
import { captureExpiry } from './expiry';
import { t } from './i18n';

/** Audio object URL for a voice capture, revoked on change/unmount. */
export function useCaptureAudioUrl(capture: CaptureRecord): string | null {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  useEffect(() => {
    if (capture.type !== 'voice') {
      setAudioUrl(null);
      return;
    }
    if (capture.audioBlob) {
      const url = URL.createObjectURL(capture.audioBlob);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setAudioUrl(capture.originalRef || null);
  }, [capture.audioBlob, capture.originalRef, capture.type]);
  return audioUrl;
}

/** Questions about this specific capture, derived locally from its fields. */
export function askSuggestions(language: Language, capture?: CaptureRecord): string[] {
  if (!capture) {
    return [
      language === 'vi' ? 'Chi tiết trong capture này?' : 'What details are in this capture?',
      language === 'vi' ? 'Tôi đã lưu cái gì thế?' : 'What did I save here?',
    ];
  }
  const derived = suggestQuestions([capture], language).map((item) => item.question);
  const fallback =
    language === 'vi' ? 'Chi tiết trong capture này?' : 'What details are in this capture?';
  return Array.from(new Set([...derived, fallback])).slice(0, 3);
}

/** Clipboard-safe text: no raw derived text, no sensitive entities. */
export function buildCopyText(capture: CaptureRecord): string {
  const safeEntities = capture.entities.filter((entity) => !isSensitiveEntity(entity, capture));
  const lines = [
    redactSensitiveText(capture.summary),
    captureExpiry(capture) ? `Expiry: ${captureExpiry(capture)}` : '',
    ...safeEntities.map((entity) => redactSensitiveText(entity)),
  ];
  return lines.filter(Boolean).join('\n');
}

export function sourceCountLabel(
  language: Language,
  sources: CaptureRecord[],
  labelFor: (type: CaptureRecord['type']) => string,
): string {
  const counts = new Map<CaptureRecord['type'], number>();
  sources.forEach((capture) => counts.set(capture.type, (counts.get(capture.type) || 0) + 1));
  const parts = Array.from(counts, ([type, count]) => `${count} ${labelFor(type)}`);
  return `${t(language, 'source')}: ${parts.join(', ')}`;
}
