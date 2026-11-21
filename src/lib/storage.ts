import { useEffect, useState } from 'react';

/** Pure byte formatter for the local-storage readout. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${Math.floor(bytes)} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[index]}`;
}

/** Real browser estimate only; `null` when the API is unavailable. */
export function useStorageEstimate(): number | null {
  const [usage, setUsage] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    void navigator.storage
      ?.estimate?.()
      .then((estimate) => {
        if (!cancelled && typeof estimate.usage === 'number') setUsage(estimate.usage);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return usage;
}
