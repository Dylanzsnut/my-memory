import type { CaptureRecord } from '../types';

/** Accepts only a real YYYY-MM or YYYY-MM-DD date; rejects "null"/junk. */
export function validExpiry(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = match[3] !== undefined ? Number(match[3]) : undefined;
  if (month < 1 || month > 12 || year < 1000) return null;
  const maxDay = new Date(year, month, 0).getDate();
  if (day !== undefined && (day < 1 || day > maxDay)) return null;
  return trimmed;
}

export function captureExpiry(capture: CaptureRecord): string | null {
  return validExpiry(capture.expiryDate);
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Numeric MM/YYYY or DD/MM/YYYY form, safe for the claim verifier. */
export function expiryNumeric(value: string | null): string | null {
  const date = validExpiry(value);
  if (!date) return null;
  const [year, month, day] = date.split('-').map(Number);
  const mm = String(month).padStart(2, '0');
  return day !== undefined ? `${String(day).padStart(2, '0')}/${mm}/${year}` : `${mm}/${year}`;
}

/** Readable date plus its numeric form so the claim verifier can match it. */
export function formatExpiry(value: string | null, language: 'en' | 'vi' = 'en'): string {
  const date = validExpiry(value);
  if (!date) return '';
  const parts = date.split('-').map(Number);
  const [year, month, day] = parts;
  const mm = String(month).padStart(2, '0');
  if (day !== undefined) {
    const dd = String(day).padStart(2, '0');
    const numeric = language === 'vi' ? `${dd}/${mm}/${year}` : `${dd}/${mm}/${year}`;
    const words =
      language === 'vi'
        ? `vào ngày ${day} tháng ${month} năm ${year}`
        : `on ${day} ${MONTHS[month - 1]} ${year}`;
    return `${words} (${numeric})`;
  }
  const numeric = `${mm}/${year}`;
  const words = language === 'vi' ? `vào tháng ${month} năm ${year}` : `in ${MONTHS[month - 1]} ${year}`;
  return `${words} (${numeric})`;
}
