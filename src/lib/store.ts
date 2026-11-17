import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { CaptureRecord, ForgetProposal, HudEvent, Language } from '../types';
import { embed } from './embeddings';
import { SEED_DEMO } from './config';

interface MemoryDB extends DBSchema {
  captures: { key: string; value: CaptureRecord; indexes: { 'by-date': string } };
  proposals: { key: string; value: ForgetProposal };
  hud: { key: string; value: HudEvent };
  meta: { key: string; value: { key: string; value: unknown } };
}

let dbPromise: Promise<IDBPDatabase<MemoryDB>> | null = null;

function db(): Promise<IDBPDatabase<MemoryDB>> {
  if (!dbPromise) {
    dbPromise = openDB<MemoryDB>('my-memory', 1, {
      upgrade(database) {
        database.createObjectStore('captures', { keyPath: 'id' }).createIndex('by-date', 'capturedAt');
        database.createObjectStore('proposals', { keyPath: 'id' });
        database.createObjectStore('hud', { keyPath: 'id' });
        database.createObjectStore('meta', { keyPath: 'key' });
      },
    });
  }
  return dbPromise;
}

export async function getCaptures(): Promise<CaptureRecord[]> {
  const all = await (await db()).getAll('captures');
  return all.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
}

export async function saveCapture(capture: CaptureRecord): Promise<void> {
  await (await db()).put('captures', capture);
}

export async function getProposals(): Promise<ForgetProposal[]> {
  const all = await (await db()).getAll('proposals');
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function saveProposal(proposal: ForgetProposal): Promise<void> {
  await (await db()).put('proposals', proposal);
}

export async function clearProposals(): Promise<void> {
  await (await db()).clear('proposals');
}

export async function addHudEvent(event: HudEvent): Promise<void> {
  await (await db()).put('hud', event);
  const all = await (await db()).getAll('hud');
  if (all.length > 60) {
    const store = (await db()).transaction('hud', 'readwrite').store;
    for (const old of all.sort((a, b) => a.at.localeCompare(b.at)).slice(0, all.length - 60)) {
      await store.delete(old.id);
    }
  }
}

export async function getHudEvents(): Promise<HudEvent[]> {
  const all = await (await db()).getAll('hud');
  return all.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);
}

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await (await db()).get('meta', key);
  return row ? (row.value as T) : fallback;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await (await db()).put('meta', { key, value });
}

interface SeedItem {
  id: string;
  type: CaptureRecord['type'];
  summary: string;
  entities: string[];
  expiryDate: string | null;
  language: Language;
  daysAgo: number;
  offsetMinutes?: number;
  derivedText?: string;
  protectedReason?: string;
  demo?: boolean;
}

const SEED_ITEMS: SeedItem[] = [
  {
    id: 'cap_lunch_receipt',
    type: 'photo',
    summary: 'Lunch receipt — total 256,000 VND',
    entities: ['256000 VND', 'lunch', 'restaurant', 'receipt', 'hoa don'],
    expiryDate: null,
    language: 'vi',
    daysAgo: 0,
    offsetMinutes: 1,
    derivedText: 'Hoa don bua trua. Tong cong 256,000 VND. VAT 7%.',
  },
  {
    id: 'cap_lunch_receipt_dup',
    type: 'photo',
    summary: 'Lunch receipt — total 256,000 VND',
    entities: ['256000 VND', 'lunch', 'restaurant', 'receipt', 'hoa don'],
    expiryDate: null,
    language: 'vi',
    daysAgo: 0,
    offsetMinutes: 0,
    derivedText: 'Hoa don bua trua. Tong cong 256,000 VND. VAT 7%.',
  },
  {
    id: 'cap_medicine_box',
    type: 'photo',
    summary: "Mum's medicine box — expiry 03/2027",
    entities: ['medicine', 'thuoc', 'mum', 'me', 'expiry', '03/2027', 'pharmacy'],
    expiryDate: '2027-03',
    language: 'vi',
    daysAgo: 5,
    derivedText: 'Exp: 03/2027. Batch VN-992. Paracetamol 500mg. Uong sau bua toi.',
    protectedReason: 'Only photo of a prescription; health information; unreadably blurry.',
  },
  {
    id: 'cap_menu',
    type: 'photo',
    summary: 'Train-street cafe menu — chicken soup 30K, spring rolls 60K',
    entities: ['menu', 'cafe', 'chicken soup 30K', 'spring roll 60K', 'prices'],
    expiryDate: null,
    language: 'en',
    daysAgo: 2,
    derivedText: 'Chicken soup 30K. Spring roll 60K. Egg coffee 45K.',
  },
  {
    id: 'cap_medicine_memo',
    type: 'voice',
    summary: 'Remember to buy medicine for mum',
    entities: ['medicine', 'thuoc', 'mum', 'me', 'pharmacy', 'reminder'],
    expiryDate: null,
    language: 'en',
    daysAgo: 1,
    derivedText: 'Remember to buy medicine for mum. The blue box, after dinner. Buy before this weekend.',
  },
  {
    id: 'cap_wifi_note',
    type: 'note',
    summary: 'Cafe wifi password: songhong2024',
    entities: ['wifi', 'password', 'mat khau', 'songhong2024', 'cafe'],
    expiryDate: null,
    language: 'en',
    daysAgo: 1,
    derivedText: 'Cafe wifi, 2nd floor. Password: songhong2024.',
  },
  {
    id: 'cap_plate_note',
    type: 'note',
    summary: 'Parking plate: 51F-842.17',
    entities: ['plate', 'bien so', '51F-842.17', 'parking', 'car'],
    expiryDate: null,
    language: 'en',
    daysAgo: 3,
    derivedText: 'Car plate in car park B: 51F-842.17. Return by Friday.',
  },
  {
    id: 'cap_walk_idea',
    type: 'voice',
    summary: 'An idea on a walk',
    entities: ['idea', 'y tuong', 'walk', 'memo'],
    expiryDate: null,
    language: 'en',
    daysAgo: 4,
    derivedText: 'An idea on a walk 0:42 — record the thought before it disappears.',
  },
  {
    id: 'cap_otp_shot',
    type: 'photo',
    summary: 'Screenshot of an OTP code',
    entities: ['otp', 'code', 'expired', '10 Nov', 'screenshot'],
    expiryDate: '2025-11-10',
    language: 'en',
    daysAgo: 7,
    derivedText: 'Your verification code is 849201. Valid for 5 minutes.',
  },
];

export async function seedDemoCaptures(): Promise<void> {
  const existing = await getCaptures();
  if (!SEED_DEMO || existing.length > 0) return;
  const now = Date.now();
  for (const item of SEED_ITEMS) {
    const searchable = [item.summary, ...item.entities, item.derivedText || ''].join(' ');
    const capture: CaptureRecord = {
      id: item.id,
      type: item.type,
      capturedAt: new Date(
        now - item.daysAgo * 86_400_000 - (item.offsetMinutes || 0) * 60_000,
      ).toISOString(),
      summary: item.summary,
      entities: item.entities,
      expiryDate: item.expiryDate,
      language: item.language,
      inferenceSource: 'SIMULATED',
      retentionState: item.protectedReason ? 'protected' : 'active',
      derivedText: item.derivedText,
      embedding: await embed(searchable),
      protectedReason: item.protectedReason,
      demo: true,
    };
    await saveCapture(capture);
  }
}
