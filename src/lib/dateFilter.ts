/** Date filters compare calendar days in the user's local time, not 24h windows. */
export type DateFilter = 'all' | 'today' | 'yesterday' | 'older';

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
  const days = daysSince(iso, now);
  if (filter === 'today') return days <= 0;
  if (filter === 'yesterday') return days === 1;
  return days >= 2;
}
