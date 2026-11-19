import type { CaptureRecord } from '../types';
import { normalize } from './embeddings';

const HEALTH_PATTERNS =
  /\b(medicine|medication|pill|pills|tablet|capsule|pharmacy|prescription|doctor|hospital|clinic|allergy|blood|dose|dosage|panadol|paracetamol|ibuprofen|aspirin|antibiotic|insulin|vitamin|vaccine|medical|thuoc|don thuoc|benh vien|bac si|lieu dung|di ung|tiem|kham)\b/;

const IDENTITY_SAFETY_PATTERNS =
  /\b(passport|ho chieu|national id|id card|cccd|cmnd|driver license|bang lai|insurance|bao hiem|emergency)\b/;

const PEOPLE_PHOTO_PATTERNS =
  /\b(person|people|human|portrait|selfie|face|faces|family|child|children|kid|kids|baby|mom|mum|mother|dad|father|friend|friends|couple|group|crowd|nguoi|chan dung|gia dinh|ban be|em be)\b/;

/**
 * Rule F4: automatically identifies captures that must be protected from
 * forgetting proposals (health/medicine, personal ID/safety, photos with people).
 */
export function detectTextProtection(
  capture: Pick<CaptureRecord, 'type' | 'summary' | 'entities' | 'derivedText' | 'tags'>,
): string | undefined {
  const haystack = normalize(
    [
      capture.summary,
      ...capture.entities,
      capture.derivedText || '',
      ...(capture.tags || []),
    ].join(' '),
  );
  if (!haystack.trim()) return undefined;
  if (HEALTH_PATTERNS.test(haystack)) {
    return 'Health or medicine record (F4 protected)';
  }
  if (IDENTITY_SAFETY_PATTERNS.test(haystack)) {
    return 'Personal identity or safety record (F4 protected)';
  }
  if (capture.type === 'photo' && PEOPLE_PHOTO_PATTERNS.test(haystack)) {
    return 'Photo with people (F4 protected)';
  }
  return undefined;
}

/**
 * Estimates whether a photo is noticeably blurry using Laplacian variance over
 * downscaled grayscale luminance in the browser canvas.
 */
export async function detectImageBlur(
  imageDataUrl: string,
  varianceThreshold = 45,
): Promise<boolean> {
  if (!imageDataUrl || typeof document === 'undefined' || typeof Image === 'undefined') {
    return false;
  }
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image decode failed'));
      el.src = imageDataUrl;
    });
    const maxSide = 160;
    const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
    const width = Math.max(1, Math.round((img.width || 1) * scale));
    const height = Math.max(1, Math.round((img.height || 1) * scale));
    if (width < 16 || height < 16) return false;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);

    const gray = new Float32Array(width * height);
    let minLum = 255;
    let maxLum = 0;
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      gray[i] = lum;
      if (lum < minLum) minLum = lum;
      if (lum > maxLum) maxLum = lum;
    }
    if (maxLum - minLum <= 8) return false;

    let sum = 0;
    let sumSq = 0;
    let count = 0;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - width] - gray[i + width];
        sum += lap;
        sumSq += lap * lap;
        count++;
      }
    }
    if (count === 0) return false;
    const mean = sum / count;
    const variance = sumSq / count - mean * mean;
    return variance < varianceThreshold;
  } catch {
    return false;
  }
}

export async function detectProtection(
  capture: Pick<CaptureRecord, 'type' | 'summary' | 'entities' | 'derivedText' | 'tags'>,
  imageDataUrl?: string,
): Promise<string | undefined> {
  const textReason = detectTextProtection(capture);
  if (textReason) return textReason;
  if (capture.type === 'photo' && imageDataUrl) {
    if (await detectImageBlur(imageDataUrl)) {
      return 'Blurry photo kept for review (F4 protected)';
    }
  }
  return undefined;
}
