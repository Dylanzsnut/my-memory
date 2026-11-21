import type { CaptureRecord } from '../types';

export interface TagCollection {
  tag: string;
  count: number;
  cover?: string;
  updatedAt: string;
}

/** One tile per user tag, most recently updated first. */
export function tagCollections(captures: CaptureRecord[]): TagCollection[] {
  const map = new Map<string, TagCollection>();
  for (const capture of captures) {
    if (capture.retentionState === 'trashed') continue;
    for (const tag of capture.tags || []) {
      const existing = map.get(tag);
      if (!existing) {
        map.set(tag, {
          tag,
          count: 1,
          cover: capture.type === 'photo' ? capture.originalRef : undefined,
          updatedAt: capture.capturedAt,
        });
      } else {
        existing.count += 1;
        if (!existing.cover && capture.type === 'photo' && capture.originalRef) {
          existing.cover = capture.originalRef;
        }
        if (new Date(capture.capturedAt) > new Date(existing.updatedAt)) {
          existing.updatedAt = capture.capturedAt;
        }
      }
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

/** Pick a capture for the preview panel, falling back to the newest. */
export function pickInspected(captures: CaptureRecord[], id: string | null): CaptureRecord | null {
  if (!captures.length) return null;
  return captures.find((capture) => capture.id === id) || captures[0];
}

export function recentCaptures(captures: CaptureRecord[], n = 8): CaptureRecord[] {
  return captures
    .filter((capture) => capture.retentionState !== 'trashed')
    .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())
    .slice(0, n);
}
