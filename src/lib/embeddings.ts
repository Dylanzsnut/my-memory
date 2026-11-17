/**
 * Local embedding layer.
 *
 * This web build ships a deterministic, fully local lexical embedder so search
 * works offline with zero model download. The CSD pins EmbeddingGemma 2 as the
 * production embedder; it is deliberately NOT substituted here — a neural
 * provider would be plugged in at this boundary, not silently swapped in.
 */

const DIM = 256;

const SYNONYMS: Record<string, string[]> = {
  medicine: ['thuoc', 'pill', 'pills', 'medication', 'pharmacy', 'prescription'],
  thuoc: ['medicine', 'pill', 'medication', 'pharmacy'],
  receipt: ['hoa', 'don', 'bill', 'invoice', 'payment'],
  lunch: ['bua', 'trua', 'receipt', 'meal', 'food'],
  plate: ['bien', 'so', 'license', 'car', 'vehicle'],
  password: ['mat', 'khau', 'wifi', 'credential'],
  wifi: ['password', 'mat', 'khau', 'network'],
  idea: ['y', 'tuong', 'thought', 'memo'],
  mum: ['me', 'mother', 'mom'],
  expiry: ['han', 'dung', 'expire', 'expired', 'expiration', 'date'],
  expired: ['het', 'han', 'expiry', 'otp', 'code'],
  menu: ['quan', 'an', 'cafe', 'food', 'price'],
};

export function normalize(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

export function tokenize(text: string): string[] {
  const words = normalize(text)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const expanded: string[] = [];
  for (const word of words) {
    expanded.push(word);
    if (word.endsWith('s')) expanded.push(word.slice(0, -1));
    for (const syn of SYNONYMS[word] || []) expanded.push(...syn.split(/\s+/));
  }
  for (let i = 0; i < words.length - 1; i++) expanded.push(`${words[i]}_${words[i + 1]}`);
  return expanded;
}

function hashToken(token: string): number {
  let h = 2166136261;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function l2(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return norm ? vector.map((v) => v / norm) : vector;
}

export function cosine(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

export async function embed(text: string): Promise<number[]> {
  const vector = new Array<number>(DIM).fill(0);
  for (const token of tokenize(text)) {
    const h = hashToken(token);
    vector[h % DIM] += token.includes('_') ? 0.7 : 1;
    vector[(h >>> 9) % DIM] += 0.35;
  }
  return l2(vector);
}
