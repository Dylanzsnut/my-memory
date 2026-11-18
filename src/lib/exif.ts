/**
 * Minimal JPEG EXIF reader.
 *
 * Reads one field only: DateTimeOriginal (EXIF tag 0x9003). No GPS, device
 * serial or any other EXIF field is read, stored or returned. Any malformed
 * input resolves to null so callers can fall back to file.lastModified.
 */

const EXIF_SIGNATURE = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
const TAG_EXIF_IFD = 0x8769;
const TAG_DATE_TIME_ORIGINAL = 0x9003;

export async function readDateTimeOriginal(blob: Blob): Promise<string | null> {
  try {
    if (blob.type && blob.type !== 'image/jpeg') return null;
    const view = new DataView(await blob.arrayBuffer());
    if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) return null; // JPEG SOI

    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      if (view.getUint8(offset) !== 0xff) break;
      const marker = view.getUint8(offset + 1);
      if (marker === 0xda || marker === 0xd9) break; // start of scan / end of image
      const size = view.getUint16(offset + 2, false);
      if (size < 2 || offset + 2 + size > view.byteLength) break;
      const segment = offset + 4;
      if (marker === 0xe1 && size >= 8 && hasExifSignature(view, segment)) {
        return readFromTiff(view, segment + 6);
      }
      offset += 2 + size;
    }
    return null;
  } catch {
    return null;
  }
}

function hasExifSignature(view: DataView, at: number): boolean {
  for (let i = 0; i < EXIF_SIGNATURE.length; i += 1) {
    if (view.getUint8(at + i) !== EXIF_SIGNATURE[i]) return false;
  }
  return true;
}

function readFromTiff(view: DataView, tiff: number): string | null {
  if (tiff + 8 > view.byteLength) return null;
  const littleEndian = view.getUint16(tiff, false) === 0x4949;
  if (view.getUint16(tiff + 2, littleEndian) !== 42) return null; // TIFF magic
  const ifd0 = tiff + view.getUint32(tiff + 4, littleEndian);
  const exifIfd = findLongValue(view, ifd0, tiff, littleEndian, TAG_EXIF_IFD);
  if (exifIfd === null) return null;
  return findAsciiValue(view, exifIfd, tiff, littleEndian, TAG_DATE_TIME_ORIGINAL);
}

function entryCount(view: DataView, ifd: number, littleEndian: boolean): number {
  return ifd + 2 <= view.byteLength ? view.getUint16(ifd, littleEndian) : 0;
}

function findLongValue(
  view: DataView,
  ifd: number,
  tiff: number,
  littleEndian: boolean,
  tag: number,
): number | null {
  const count = entryCount(view, ifd, littleEndian);
  for (let i = 0; i < count; i += 1) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;
    if (view.getUint16(entry, littleEndian) !== tag) continue;
    if (view.getUint16(entry + 2, littleEndian) !== 4) return null; // LONG
    return tiff + view.getUint32(entry + 8, littleEndian);
  }
  return null;
}

function findAsciiValue(
  view: DataView,
  ifd: number,
  tiff: number,
  littleEndian: boolean,
  tag: number,
): string | null {
  const count = entryCount(view, ifd, littleEndian);
  for (let i = 0; i < count; i += 1) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;
    if (view.getUint16(entry, littleEndian) !== tag) continue;
    if (view.getUint16(entry + 2, littleEndian) !== 2) return null; // ASCII
    const length = view.getUint32(entry + 4, littleEndian);
    if (length < 19 || length > 64) return null;
    const at = length <= 4 ? entry + 8 : tiff + view.getUint32(entry + 8, littleEndian);
    if (at + length > view.byteLength) return null;
    let raw = '';
    for (let j = 0; j < length - 1; j += 1) raw += String.fromCharCode(view.getUint8(at + j));
    return toIso(raw);
  }
  return null;
}

/** EXIF format: "YYYY:MM:DD HH:MM:SS" in local camera time. */
function toIso(raw: string): string | null {
  const match = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(raw);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const date = new Date(year, month - 1, day, hour, minute, second);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date.toISOString();
}
