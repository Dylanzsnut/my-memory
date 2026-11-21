/** Date filters compare calendar days in the user's local time, not 24h windows. */
import type { CaptureRecord } from '../types';

export type DateFilter = 'all' | 'week' | 'month' | 'year' | 'older';
export type TypeFilter = 'all' | CaptureRecord['type'];

function localDay(ms: number): number {
  const date = new Date(ms);
  // Date.UTC on local components avoids DST jumps in the day difference.
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

export function daysSince(iso: string, now: Date = new Date()): number {
  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) return Number.POSITIVE_INFINITY;
  return Math.round((localDay(now.getTime()) - localDay(timestamp)) / 86_400_000);
}

export function matchesDateFilter(iso: string, filter: DateFilter, now: Date = new Date()): boolean {
  if (filter === 'all') return true;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  const days = daysSince(iso, now);
  if (filter === 'week') return days >= 0 && days < 7;
  if (filter === 'month') return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  if (filter === 'year') return date.getFullYear() === now.getFullYear();
  return days >= 365;
}

export function countByType(captures: CaptureRecord[]): Record<TypeFilter, number> {
  const result: Record<TypeFilter, number> = { all: captures.length, photo: 0, voice: 0, note: 0 };
  captures.forEach((capture) => {
    result[capture.type] += 1;
  });
  return result;
}

/** Newest-first, capped page of a list. */
export function paginate<T>(items: T[], page: number, size: number): T[] {
  const start = Math.max(0, page) * size;
  return items.slice(0, start + size);
}

export function navTarget(order: string[], id: string, direction: -1 | 1): string | null {
  const index = order.indexOf(id);
  if (index === -1) return null;
  const next = index + direction;
  return next < 0 || next >= order.length ? null : order[next];
}
