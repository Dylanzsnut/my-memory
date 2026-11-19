/**
 * Local embedding layer.
 *
 * This web build ships a deterministic, fully local lexical embedder so search
 * works offline with zero model download. The CSD pins EmbeddingGemma 2 as the
 * production embedder; it is deliberately NOT substituted here — a neural
 * provider would be plugged in at this boundary, not silently swapped in.
 */

export const EMBEDDING_DIM = 512;

export const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'did', 'do', 'does', 'for', 'from',
  'how', 'i', 'in', 'is', 'it', 'its', 'my', 'of', 'on', 'or', 'that', 'the', 'this',
  'to', 'was', 'were', 'what', 'when', 'where', 'which', 'who', 'why', 'will', 'with',
  'you', 'your',
  // Question boilerplate: carries no retrieval signal and dilutes tag questions.
  'have', 'has', 'had', 'about', 'anything', 'something', 'show', 'find', 'tell',
  'remember', 'please', 'any', 'got', 'get', 'can', 'could', 'would', 'give', 'list',
  'la', 'cua', 'va', 'nhung', 'cac', 'cho', 'voi', 'trong', 'o', 'tai', 'khi', 'nao',
  'dau', 'gi', 'ai', 'sao', 'bao', 'co', 'khong', 'duoc', 'bi', 'da', 'se', 'dang',
  'thi', 'ma', 'nay', 'do', 'kia', 'toi', 'minh', 'ban', 'anh', 'em',
]);

export const SYNONYMS: Record<string, string[]> = {
  medicine: ['thuoc', 'pill', 'pills', 'tablet', 'medication', 'pharmacy', 'prescription', 'panadol', 'paracetamol', 'aspirin'],
  thuoc: ['medicine', 'pill', 'medication', 'pharmacy', 'prescription', 'panadol', 'paracetamol'],
  panadol: ['medicine', 'thuoc', 'pill', 'paracetamol'],
  paracetamol: ['medicine', 'thuoc', 'pill', 'panadol'],
  prescription: ['medicine', 'thuoc', 'doctor', 'pharmacy'],
  doctor: ['bac', 'clinic', 'hospital', 'prescription', 'medicine'],
  hospital: ['clinic', 'doctor', 'benh', 'vien', 'medicine'],
  hop: ['box', 'package'],
  box: ['hop', 'package'],
  receipt: ['hoa', 'don', 'bill', 'invoice', 'payment'],
  hoa: ['receipt', 'bill', 'invoice'],
  don: ['receipt', 'bill', 'invoice', 'prescription'],
  bill: ['receipt', 'invoice', 'payment', 'hoa', 'don'],
  invoice: ['receipt', 'bill', 'payment', 'hoa', 'don'],
  coffee: ['cafe', 'ca', 'phe', 'drink', 'receipt'],
  cafe: ['coffee', 'ca', 'phe', 'drink'],
  lunch: ['bua', 'trua', 'receipt', 'meal', 'food'],
  bua: ['lunch', 'meal', 'trua', 'food'],
  trua: ['lunch', 'meal', 'bua', 'food'],
  dinner: ['toi', 'meal', 'food'],
  an: ['food', 'meal', 'lunch', 'restaurant', 'quan'],
  chi: ['spending', 'expense', 'cost', 'spent'],
  spending: ['chi', 'tieu', 'expense', 'cost', 'total', 'spent'],
  spent: ['spending', 'expense', 'cost', 'chi'],
  phi: ['cost', 'expense', 'fee'],
  tong: ['total', 'sum', 'summary'],
  total: ['tong', 'sum', 'summary', 'amount'],
  plate: ['bien', 'so', 'license', 'car', 'vehicle', 'motorbike'],
  bien: ['plate', 'license', 'car', 'motorbike'],
  so: ['plate', 'number', 'license'],
  xe: ['car', 'vehicle', 'plate', 'motorbike', 'parking'],
  motorbike: ['xe', 'may', 'plate', 'parking'],
  parking: ['bai', 'gui', 'xe', 'garage', 'plate'],
  password: ['mat', 'khau', 'wifi', 'credential', 'passcode', 'passphrase'],
  passcode: ['password', 'pin', 'otp', 'mat', 'khau'],
  mat: ['password', 'credential'],
  khau: ['password', 'credential'],
  wifi: ['password', 'mat', 'khau', 'network', 'router'],
  otp: ['code', 'verification', 'pin', 'passcode'],
  code: ['otp', 'verification', 'pin', 'passcode'],
  idea: ['y', 'tuong', 'thought', 'memo'],
  mum: ['me', 'mother', 'mom'],
  mom: ['me', 'mother', 'mum'],
  me: ['mum', 'mom', 'mother'],
  expiry: ['han', 'dung', 'expire', 'expired', 'expires', 'expiration', 'date', 'valid'],
  expire: ['expiry', 'expired', 'expires', 'expiration', 'han', 'dung'],
  expires: ['expiry', 'expire', 'expired', 'expiration', 'han', 'dung'],
  expired: ['het', 'han', 'expiry', 'otp', 'code'],
  han: ['expiry', 'expired', 'expires', 'expiration', 'date'],
  dung: ['expiry', 'expired', 'expires', 'expiration'],
  het: ['expired', 'expiry'],
  warranty: ['guarantee', 'bao', 'hanh', 'receipt'],
  passport: ['ho', 'chieu', 'visa', 'id'],
  menu: ['quan', 'an', 'cafe', 'food', 'price'],
};

export function normalize(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/['’]s\b/g, '');
}

export function rawWords(text: string): string[] {
  return normalize(text)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function contentWords(text: string): string[] {
  const words = rawWords(text);
  const filtered = words.filter((w) => !STOPWORDS.has(w));
  return filtered.length > 0 ? filtered : words;
}

export function tokenize(text: string): string[] {
  const words = contentWords(text);
  const expanded: string[] = [];
  for (const word of words) {
    expanded.push(word);
    if (word.length > 3 && word.endsWith('s')) expanded.push(word.slice(0, -1));
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
  const vector = new Array<number>(EMBEDDING_DIM).fill(0);
  const baseSet = new Set(contentWords(text));
  for (const token of tokenize(text)) {
    const weight = baseSet.has(token) ? 1 : token.includes('_') ? 0.65 : 0.45;
    const h1 = hashToken(token);
    const h2 = hashToken(`${token}#2`);
    const s1 = h1 & 1 ? 1 : -1;
    const s2 = h2 & 1 ? 1 : -1;
    vector[(h1 >>> 1) % EMBEDDING_DIM] += s1 * weight;
    vector[(h2 >>> 1) % EMBEDDING_DIM] += s2 * (weight * 0.5);
  }
  return l2(vector);
}
