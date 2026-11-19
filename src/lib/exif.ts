/**
 * Privacy-safe EXIF timestamp reader.
 *
 * Reads ONLY tag 0x9003 (DateTimeOriginal) from JPEG APP1 EXIF headers.
 * GPS (0x8825), device make/model, serial numbers, and all other EXIF tags
 * are intentionally ignored and never stored or synced.
 */

const EXIF_HEADER_BYTES = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
const TAG_EXIF_IFD_POINTER = 0x8769;
const TAG_DATE_TIME_ORIGINAL = 0x9003;

function parseExifDateString(raw: string): string | null {
  const match = raw.trim().match(/^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (year < 1970 || year > 2100 || month < 1 || month > 12) return null;
  const maxDay = new Date(year, month, 0).getDate();
  if (day < 1 || day > maxDay) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  const parsed = new Date(year, month - 1, day, hour, minute, second);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function readAsciiTag(
  view: DataView,
  tiffStart: number,
  entryOffset: number,
  littleEndian: boolean,
): string | null {
  const type = view.getUint16(entryOffset + 2, littleEndian);
  const count = view.getUint32(entryOffset + 4, littleEndian);
  if (type !== 2 || count < 19 || count > 64) return null;
  const valueOffset =
    count <= 4
      ? entryOffset + 8
      : tiffStart + view.getUint32(entryOffset + 8, littleEndian);
  if (valueOffset < 0 || valueOffset + count > view.byteLength) return null;
  let result = '';
  for (let i = 0; i < count; i++) {
    const code = view.getUint8(valueOffset + i);
    if (code === 0) break;
    result += String.fromCharCode(code);
  }
  return result;
}

function findDateTimeOriginalInIfd(
  view: DataView,
  tiffStart: number,
  ifdOffset: number,
  littleEndian: boolean,
  depth = 0,
): string | null {
  if (depth > 2) return null;
  const pos = tiffStart + ifdOffset;
  if (pos < 0 || pos + 2 > view.byteLength) return null;
  const entryCount = view.getUint16(pos, littleEndian);
  if (entryCount > 256) return null;

  for (let i = 0; i < entryCount; i++) {
    const entry = pos + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;
    const tag = view.getUint16(entry, littleEndian);
    if (tag === TAG_DATE_TIME_ORIGINAL) {
      const raw = readAsciiTag(view, tiffStart, entry, littleEndian);
      if (raw) {
        const iso = parseExifDateString(raw);
        if (iso) return iso;
      }
    } else if (tag === TAG_EXIF_IFD_POINTER && depth === 0) {
      const exifSubIfd = view.getUint32(entry + 8, littleEndian);
      const nested = findDateTimeOriginalInIfd(view, tiffStart, exifSubIfd, littleEndian, depth + 1);
      if (nested) return nested;
    }
  }
  return null;
}

export function parseExifDateTimeOriginal(buffer: ArrayBuffer): string | null {
  if (buffer.byteLength < 16) return null;
  const view = new DataView(buffer);
  if (view.getUint16(0, false) !== 0xffd8) return null; // Not a JPEG SOI

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    if (marker === 0xda || marker === 0xd9) break; // SOS / EOI
    if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      offset += 2;
      continue;
    }

    const segmentLen = view.getUint16(offset + 2, false);
    if (segmentLen < 2) break;
    const segmentEnd = offset + 2 + segmentLen;
    if (segmentEnd > view.byteLength) break;

    if (marker === 0xe1 && segmentLen >= 16) {
      const hasExifHeader = EXIF_HEADER_BYTES.every(
        (byte, idx) => view.getUint8(offset + 4 + idx) === byte,
      );
      if (hasExifHeader) {
        const tiffStart = offset + 10;
        if (tiffStart + 8 <= segmentEnd) {
          const byteOrder = view.getUint16(tiffStart, false);
          const littleEndian = byteOrder === 0x4949 ? true : byteOrder === 0x4d4d ? false : null;
          if (littleEndian !== null && view.getUint16(tiffStart + 2, littleEndian) === 0x002a) {
            const ifd0Offset = view.getUint32(tiffStart + 4, littleEndian);
            const found = findDateTimeOriginalInIfd(view, tiffStart, ifd0Offset, littleEndian);
            if (found) return found;
          }
        }
      }
    }
    offset = segmentEnd;
  }
  return null;
}

export async function extractPhotoCapturedAt(file: File): Promise<string> {
  try {
    const headerSlice = file.slice(0, 131_072);
    const buffer = await headerSlice.arrayBuffer();
    const exifDate = parseExifDateTimeOriginal(buffer);
    if (exifDate) return exifDate;
  } catch {
    // Fall back to file timestamp if EXIF header read fails.
  }
  if (typeof file.lastModified === 'number' && file.lastModified > 0) {
    const modified = new Date(file.lastModified);
    if (!Number.isNaN(modified.getTime())) return modified.toISOString();
  }
  return new Date().toISOString();
}
