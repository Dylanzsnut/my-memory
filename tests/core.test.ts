import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CaptureRecord } from '../src/types';
import { embed, contentWords } from '../src/lib/embeddings';
import { isLongSynthesisQuestion, searchCaptures, tagBrowseTarget } from '../src/lib/search';
import { buildAnswer, extractNumberTokens, verifyClaim } from '../src/lib/answer';
import { hasSensitiveEntities, isSensitiveEntity, isTransientAiError, withTimeout } from '../src/lib/ai';
import {
  applyDecision,
  moveToTrash,
  purgeExpiredTrash,
  scanForProposals,
} from '../src/lib/forget';
import { detectTextProtection } from '../src/lib/protection';
import { computeTagGroups, isSensitiveLabelToken, prepareEntityTag } from '../src/lib/tags';
import { sortTagOptions } from '../src/lib/tagOptions';
import { parseExifDateTimeOriginal } from '../src/lib/exif';
import { matchesDateFilter, countByType, navTarget, paginate } from '../src/lib/dateFilter';
import { formatBytes } from '../src/lib/storage';
import { tagCollections, recentCaptures, pickInspected } from '../src/lib/collections';
import { buildCopyText, askSuggestions } from '../src/lib/captureView';
import { suggestQuestions } from '../src/lib/askSuggestions';
import { validExpiry, captureExpiry, formatExpiry } from '../src/lib/expiry';
import { settings } from '../src/lib/config';

async function makeCapture(
  overrides: Partial<CaptureRecord> & Pick<CaptureRecord, 'id' | 'type' | 'summary'>,
): Promise<CaptureRecord> {
  const entities = overrides.entities || [];
  const tags = overrides.tags || [];
  const derivedText = overrides.derivedText;
  const searchSource = [overrides.summary, ...entities, ...tags, derivedText || ''].join(' ');
  return {
    capturedAt: '2026-11-10T10:00:00.000Z',
    entities,
    expiryDate: null,
    language: 'en',
    inferenceSource: 'ON_DEVICE',
    retentionState: 'active',
    embedding: overrides.embedding || (await embed(searchSource)),
    ...overrides,
  };
}

async function createCorpus(): Promise<CaptureRecord[]> {
  return Promise.all([
    makeCapture({
      id: 'cap_med',
      type: 'photo',
      summary: "Mum's medicine box — expires 08/2027",
      entities: ['medicine', '08/2027'],
      expiryDate: '2027-08',
      protectedReason: 'Health or medicine record (F4 protected)',
      retentionState: 'protected',
      tags: ['health'],
    }),
    makeCapture({
      id: 'cap_lunch1',
      type: 'photo',
      summary: 'Highlands Coffee lunch receipt — 45.000 VND',
      entities: ['45.000 VND', 'Highlands Coffee'],
      tags: ['receipts'],
    }),
    makeCapture({
      id: 'cap_lunch2',
      type: 'photo',
      summary: 'Bun Cha lunch receipt — 65.000 VND',
      entities: ['65.000 VND', 'Bun Cha'],
      tags: ['receipts'],
    }),
    makeCapture({
      id: 'cap_wifi',
      type: 'note',
      summary: 'Home Wi-Fi password: songhong2024',
      entities: ['wifi', 'password', 'songhong2024'],
    }),
    makeCapture({
      id: 'cap_plate',
      type: 'photo',
      summary: 'Parking lot motorbike license plate 51F-123.45',
      entities: ['51F-123.45', 'plate'],
    }),
    makeCapture({
      id: 'cap_expired',
      type: 'note',
      summary: 'Expired store voucher from 01/2025',
      entities: ['voucher', '01/2025'],
      expiryDate: '2025-01',
    }),
    makeCapture({
      id: 'cap_trashed',
      type: 'note',
      summary: 'Secret alpha77 archive',
      entities: ['alpha77'],
      retentionState: 'trashed',
      trashedAt: '2026-10-01T00:00:00.000Z',
      purgeAt: '2026-10-31T00:00:00.000Z',
    }),
  ]);
}

describe('embeddings and search', () => {
  it('filters EN and VI stopwords while preserving domain terms', () => {
    const words = contentWords('When does mum medicine expire và của tôi');
    assert.equal(words.includes('when'), false);
    assert.equal(words.includes('does'), false);
    assert.equal(words.includes('va'), false);
    assert.equal(words.includes('cua'), false);
    assert.equal(words.includes('medicine'), true);
    assert.equal(words.includes('expire'), true);
  });

  it('matches bilingual EN/VI queries and excludes trashed captures', async () => {
    const corpus = await createCorpus();
    const viMed = await searchCaptures('Hộp thuốc của mẹ hạn dùng khi nào?', corpus, 0.28);
    assert.equal(viMed[0]?.capture.id, 'cap_med');

    const trashedHits = await searchCaptures('alpha77', corpus, 0.1);
    assert.equal(trashedHits.length, 0);
  });

  it('honours a tag-only query in the shared tag index', async () => {
    const corpus = await createCorpus();
    const hits = await searchCaptures('#receipts', corpus, 0.1);
    assert.ok(hits.length >= 2);
    assert.deepEqual(
      hits.slice(0, 2).map((hit) => hit.capture.id).sort(),
      ['cap_lunch1', 'cap_lunch2'],
    );
    assert.ok(!hits.slice(0, 2).some((hit) => hit.capture.id === 'cap_med'));
  });

  it('detects long synthesis questions', () => {
    assert.equal(isLongSynthesisQuestion('total my lunch spending'), true);
    assert.equal(isLongSynthesisQuestion('tổng chi ăn trưa'), true);
    assert.equal(isLongSynthesisQuestion('wifi password'), false);
  });
});

describe('answer assembly, corpus QA, and fail-closed verifier', () => {
  it('answers 5 in-corpus EN/VI questions with verified citations', async () => {
    const corpus = await createCorpus();
    const cases: Array<[string, string]> = [
      ["When does mum's medicine expire?", 'cap_med'],
      ['Hộp thuốc của mẹ hạn dùng khi nào?', 'cap_med'],
      ['wifi password', 'cap_wifi'],
      ['biển số xe', 'cap_plate'],
      ['lunch receipt', 'cap_lunch1'],
    ];
    for (const [question, expectedId] of cases) {
      const res = await buildAnswer(question, corpus, 0.28);
      assert.equal(res.notFound, false, `Expected found for "${question}", got: ${res.text}`);
      assert.ok(res.claims.length >= 1, `Expected claims for "${question}"`);
      assert.ok(
        res.sources.some((s) => s.id === expectedId || (expectedId === 'cap_lunch1' && s.id.startsWith('cap_lunch'))),
        `Expected ${expectedId} in sources for "${question}"`,
      );
    }
  });

  it('returns Not found for 5 out-of-corpus and trashed questions', async () => {
    const corpus = await createCorpus();
    const outOfCorpus: Array<[string, 'en' | 'vi']> = [
      ['What is the weather in Tokyo tomorrow?', 'en'],
      ['Who won the 2022 World Cup final?', 'en'],
      ['Flight confirmation to Paris CDG', 'en'],
      ['Thời tiết Hà Nội hôm nay bao nhiêu độ?', 'vi'],
      ['alpha77', 'en'],
    ];
    for (const [question, lang] of outOfCorpus) {
      const res = await buildAnswer(question, corpus, 0.28, { language: lang });
      assert.equal(res.notFound, true, `Expected Not found for "${question}", got "${res.text}"`);
      assert.equal(res.claims.length, 0);
      assert.equal(res.sources.length, 0);
    }
  });

  it('enforces whole-number, alphanumeric code, and token overlap in verifyClaim', async () => {
    const corpus = await createCorpus();
    const lunch = corpus.find((c) => c.id === 'cap_lunch1')!;
    const wifi = corpus.find((c) => c.id === 'cap_wifi')!;
    const med = corpus.find((c) => c.id === 'cap_med')!;

    assert.deepEqual(extractNumberTokens('45.000 VND on 08/2027 and 2027-08'), ['45000', 'ym:2027-08', 'ym:2027-08']);
    assert.equal(verifyClaim('Lunch cost 45 [cap_lunch1].', lunch), false);
    assert.equal(verifyClaim('Lunch cost 5 [cap_lunch1].', lunch), false);
    assert.equal(verifyClaim('Lunch cost 45,000 VND at Highlands Coffee [cap_lunch1].', lunch), true);
    assert.equal(verifyClaim('In 08/2027 [cap_med].', med), true);
    assert.equal(verifyClaim('Home Wi-Fi password is fake9999 [cap_wifi].', wifi), false);
    assert.equal(verifyClaim('Home Wi-Fi password is songhong2024 [cap_wifi].', wifi), true);
    assert.equal(verifyClaim('Drink water every morning [cap_med].', med), false);
  });

  it('never treats "null" or invalid expiry text as evidence', async () => {
    const bad = await makeCapture({ id: 'bad', type: 'note', summary: 'Meeting notes', expiryDate: 'null' as unknown as string });
    assert.equal(validExpiry('null'), null);
    assert.equal(validExpiry(''), null);
    assert.equal(validExpiry('2027-13'), null);
    assert.equal(validExpiry('2027-03'), '2027-03');
    assert.equal(formatExpiry('2027-03', 'en'), 'in March 2027 (03/2027)');
    assert.equal(formatExpiry('2025-11-10', 'en'), 'on 10 November 2025 (10/11/2025)');
    assert.equal(formatExpiry('null', 'en'), '');
    assert.equal(captureExpiry(bad), null);
    assert.equal(verifyClaim('In null. [bad]', bad), false);
    assert.equal(verifyClaim('In March 2027. [bad]', bad), false);
    const answer = await buildAnswer('When does this expire?', [bad], 0);
    assert.equal(answer.notFound, true);
    assert.doesNotMatch(answer.text, /null/i);
  });

  it('refuses long synthesis offline instead of returning a stitched SIMULATED list', async () => {
    const corpus = await createCorpus();
    const prevDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: false },
      configurable: true,
    });
    try {
      const res = await buildAnswer('total my lunch spending', corpus, 0.28);
      assert.equal(res.notFound, true);
      assert.equal(res.error, 'OFFLINE_SYNTHESIS_REQUIRES_CONNECTION');
      assert.equal(res.claims.length, 0);
    } finally {
      if (prevDescriptor) {
        Object.defineProperty(globalThis, 'navigator', prevDescriptor);
      } else {
        delete (globalThis as { navigator?: unknown }).navigator;
      }
    }
  });

  it('identifies sensitive entities on credential captures without flagging normal receipts', async () => {
    const corpus = await createCorpus();
    const wifi = corpus.find((c) => c.id === 'cap_wifi')!;
    const lunch = corpus.find((c) => c.id === 'cap_lunch1')!;
    assert.equal(isSensitiveEntity('songhong2024', wifi), true);
    assert.equal(hasSensitiveEntities([wifi]), true);
    assert.equal(isSensitiveEntity('45.000 VND', lunch), false);
    assert.equal(hasSensitiveEntities([lunch]), false);
  });
});

describe('forgetting proposals, trash purge, and auto F4 protection', () => {
  it('scans F1 duplicates and F2 expirations while respecting F4 protection', async () => {
    const sharedVec = await embed('Coffee receipt 45.000 VND');
    const olderDup = await makeCapture({
      id: 'cap_dup_old',
      type: 'photo',
      summary: 'Coffee receipt 45.000 VND',
      capturedAt: '2026-11-01T10:00:00.000Z',
      embedding: sharedVec,
    });
    const newerDup = await makeCapture({
      id: 'cap_dup_new',
      type: 'photo',
      summary: 'Coffee receipt 45.000 VND',
      capturedAt: '2026-11-02T10:00:00.000Z',
      embedding: sharedVec,
    });
    const protectedDup = await makeCapture({
      id: 'cap_med_dup',
      type: 'photo',
      summary: 'Coffee receipt 45.000 VND',
      capturedAt: '2026-10-30T10:00:00.000Z',
      expiryDate: '2024-01',
      protectedReason: 'Health record',
      embedding: sharedVec,
    });
    const expired = await makeCapture({
      id: 'cap_exp',
      type: 'note',
      summary: 'Old voucher',
      expiryDate: '2024-01',
    });

    const proposals = scanForProposals([olderDup, newerDup, protectedDup, expired], 0.86, []);
    assert.equal(proposals.some((p) => p.captureId === 'cap_dup_new' && p.reason === 'duplicate'), true);
    assert.equal(proposals.some((p) => p.captureId === 'cap_dup_old'), false);
    assert.equal(proposals.some((p) => p.captureId === 'cap_exp' && p.reason === 'expired'), true);
    assert.equal(proposals.some((p) => p.captureId === 'cap_med_dup'), false);

    const trashed = moveToTrash(olderDup, 30, 'manual');
    assert.equal(trashed.retentionState, 'trashed');
    assert.equal(trashed.trashSource, 'manual');
    assert.ok(trashed.purgeAt);

    const kept = applyDecision(olderDup, 'keep', 30);
    assert.equal(kept.retentionState, 'active');
    const afterKeep = scanForProposals(
      [olderDup, newerDup],
      0.86,
      proposals.filter((p) => p.captureId === 'cap_dup_new').map((p) => ({ ...p, decided: 'keep' as const })),
    );
    assert.equal(afterKeep.some((p) => p.captureId === 'cap_dup_new'), false);

    const beforeExpiry = purgeExpiredTrash([trashed, expired], Date.now() + 10 * 86_400_000);
    assert.equal(beforeExpiry.purged.length, 0);
    assert.equal(beforeExpiry.active.length, 2);

    const afterExpiry = purgeExpiredTrash([trashed, expired], Date.now() + 31 * 86_400_000);
    assert.equal(afterExpiry.purged.map((c) => c.id).includes('cap_dup_old'), true);
    assert.equal(afterExpiry.active.map((c) => c.id).includes('cap_exp'), true);
  });

  it('auto-detects F4 protection reasons for health, identity, and people photos', () => {
    assert.ok(
      detectTextProtection({
        type: 'note',
        summary: 'Take Paracetamol tablet after dinner',
        entities: ['Paracetamol'],
      }),
    );
    assert.ok(
      detectTextProtection({
        type: 'photo',
        summary: 'Passport copy for flight',
        entities: ['passport'],
      }),
    );
    assert.ok(
      detectTextProtection({
        type: 'photo',
        summary: 'Family portrait at park',
        entities: ['family', 'portrait'],
      }),
    );
    assert.equal(
      detectTextProtection({
        type: 'photo',
        summary: 'Highlands Coffee receipt 45.000 VND',
        entities: ['45.000 VND'],
      }),
      undefined,
    );
  });
});

describe('auto-tagging and JPEG EXIF parser', () => {
  it('clusters similar captures into tag suggestions and excludes sensitive tokens', async () => {
    const shared = await embed('Coffee receipt Highlands morning');
    const c1 = await makeCapture({
      id: 'cap_t1',
      type: 'photo',
      summary: 'Highlands Coffee receipt morning',
      entities: ['Highlands'],
      embedding: shared,
    });
    const c2 = await makeCapture({
      id: 'cap_t2',
      type: 'photo',
      summary: 'Highlands Coffee receipt afternoon',
      entities: ['Highlands'],
      embedding: shared,
    });

    const { groups, suggestedByCapture } = computeTagGroups([c1, c2], settings, []);
    assert.equal(groups.length, 1);
    assert.ok((suggestedByCapture.get('cap_t1') || []).length >= 1);
    assert.equal(isSensitiveLabelToken('password', new Set()), true);
    assert.equal(isSensitiveLabelToken('secretcode', new Set(['secretcode'])), true);
    assert.equal(isSensitiveLabelToken('coffee', new Set()), false);
  });

  it('parses JPEG EXIF DateTimeOriginal and rejects non-JPEG bytes', () => {
    assert.equal(parseExifDateTimeOriginal(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]).buffer), null);

    // Construct minimal big-endian JPEG APP1 Exif payload with IFD0 -> ExifIFDPointer(0x8769) -> DateTimeOriginal(0x9003)
    const dateStr = '2026:11:18 09:30:15\0';
    const buf = new Uint8Array(120);
    const dv = new DataView(buf.buffer);
    let p = 0;
    // SOI
    buf[p++] = 0xff;
    buf[p++] = 0xd8;
    // APP1 marker + length placeholder
    buf[p++] = 0xff;
    buf[p++] = 0xe1;
    const lenOffset = p;
    p += 2;
    // Exif\0\0
    buf.set([0x45, 0x78, 0x69, 0x66, 0x00, 0x00], p);
    p += 6;
    const tiff = p;
    // Big-endian TIFF header MM 0x002A offset 8
    buf[tiff] = 0x4d;
    buf[tiff + 1] = 0x4d;
    dv.setUint16(tiff + 2, 0x002a, false);
    dv.setUint32(tiff + 4, 8, false);
    // IFD0 at tiff+8: 1 entry (0x8769 ExifIFDPointer) -> ExifIFD at offset 26
    dv.setUint16(tiff + 8, 1, false);
    dv.setUint16(tiff + 10, 0x8769, false);
    dv.setUint16(tiff + 12, 4, false);
    dv.setUint32(tiff + 14, 1, false);
    dv.setUint32(tiff + 18, 26, false);
    dv.setUint32(tiff + 22, 0, false);
    // ExifIFD at tiff+26: 1 entry (0x9003 DateTimeOriginal, ASCII count 20) -> value at offset 44
    dv.setUint16(tiff + 26, 1, false);
    dv.setUint16(tiff + 28, 0x9003, false);
    dv.setUint16(tiff + 30, 2, false);
    dv.setUint32(tiff + 32, dateStr.length, false);
    dv.setUint32(tiff + 36, 44, false);
    dv.setUint32(tiff + 40, 0, false);
    for (let i = 0; i < dateStr.length; i++) {
      buf[tiff + 44 + i] = dateStr.charCodeAt(i);
    }
    const end = tiff + 44 + dateStr.length;
    dv.setUint16(lenOffset, end - lenOffset, false);

    const parsed = parseExifDateTimeOriginal(buf.slice(0, end).buffer);
    assert.ok(parsed);
    const d = new Date(parsed!);
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 10); // November
    assert.equal(d.getDate(), 18);
  });
});

describe('tag = group (local-only, per-capture)', () => {
  it('selects untagged captures and lets a newly added tag group them', async () => {
    const corpus = await Promise.all([
      makeCapture({ id: 'c1', type: 'note', summary: 'Plain note', tags: undefined }),
      makeCapture({ id: 'c2', type: 'note', summary: 'Casanos booking', tags: ['Casanos'] }),
      makeCapture({ id: 'c3', type: 'photo', summary: 'Casanos bill', tags: ['Casanos', 'receipt'] }),
    ]);
    assert.deepEqual(corpus.filter((c) => !(c.tags || []).length).map((c) => c.id), ['c1']);
    const firstTagGroup = (tag: string) =>
      corpus.filter((c) => (c.tags || [])[0] === tag).map((c) => c.id);
    assert.deepEqual(firstTagGroup('Casanos'), ['c2', 'c3']);
    assert.deepEqual(firstTagGroup('receipt'), [], 'a capture appears under its first tag only');
  });

  it('renames/removes a tag on one capture without touching the others', async () => {
    const [a, b] = await Promise.all([
      makeCapture({ id: 'a', type: 'note', summary: 'One', tags: ['old'] }),
      makeCapture({ id: 'b', type: 'note', summary: 'Two', tags: ['old'] }),
    ]);
    const renamed = { ...a, tags: ['new'] };
    assert.deepEqual(renamed.tags, ['new']);
    assert.deepEqual(b.tags, ['old']);
    const untagged = { ...b, tags: [] };
    assert.deepEqual(untagged.tags, []);
    assert.deepEqual(b.tags, ['old']);
  });
});

describe('local-first Ask: tags, synonyms and speed', () => {
  const makeTagged = async () => [
    await makeCapture({ id: 'cap_t1', type: 'photo', summary: 'Dinner bill 45.000 VND', tags: ['Casanos'] }),
    await makeCapture({ id: 'cap_t2', type: 'note', summary: 'Booked table for Friday', tags: ['Casanos', 'UI'] }),
    await makeCapture({ id: 'cap_t3', type: 'note', summary: 'Wifi password songhong2024', entities: ['wifi'] }),
  ];

  it('detects tag-browse questions in EN and VI and ignores ordinary ones', () => {
    const tags = ['Casanos', 'UI', 'sdasda'];
    assert.equal(tagBrowseTarget('What do I have about Casanos?', tags), 'Casanos');
    assert.equal(tagBrowseTarget('#UI', tags), 'UI');
    assert.equal(tagBrowseTarget('Tôi có gì trong sdasda?', tags), 'sdasda');
    assert.equal(tagBrowseTarget('wifi password', tags), null);
    assert.equal(tagBrowseTarget('When is the Casanos booking?', tags), null);
  });

  it('answers a brand-new tag locally with citations and no unrelated captures', async () => {
    const corpus = await makeTagged();
    const result = await buildAnswer('What do I have about Casanos?', corpus, 0, {
      browseTag: 'Casanos',
    });
    assert.equal(result.notFound, false);
    assert.equal(result.inferenceSource, 'SIMULATED');
    assert.deepEqual(result.sources.map((c) => c.id).sort(), ['cap_t1', 'cap_t2']);
    assert.ok(result.claims.every((c) => c.verified));
    const none = await buildAnswer('x', corpus, 0, { browseTag: 'nonexistent' });
    assert.equal(none.notFound, true);
  });

  it('finds a tag added after capture through ordinary search', async () => {
    const corpus = await makeTagged();
    const hits = await searchCaptures('What do I have about Casanos?', corpus, 0.35);
    assert.deepEqual(hits.slice(0, 2).map((h) => h.capture.id).sort(), ['cap_t1', 'cap_t2']);
    assert.ok(!hits.some((h) => h.capture.id === 'cap_t3'));
  });

  it('clears the threshold on a synonym-only hit but still refuses out-of-corpus probes', async () => {
    const corpus = await makeTagged();
    const synonym = await searchCaptures('lunch receipt', [corpus[0]], 0.35);
    assert.equal(synonym.length, 1);
    for (const probe of ['passport number', 'blood pressure reading', 'flight to Tokyo']) {
      const miss = await buildAnswer(probe, corpus, 0.35);
      assert.equal(miss.notFound, true, probe);
    }
  });

  it('classifies AI errors and enforces timeouts', async () => {
    assert.equal(isTransientAiError(new Error('403 PERMISSION_DENIED: enforce App Check')), false);
    assert.equal(isTransientAiError(new Error('Failed to fetch')), false);
    assert.equal(isTransientAiError(new Error('503 Service Unavailable')), true);
    await assert.rejects(withTimeout(new Promise(() => undefined), 20, 'test call'), /timed out/);
    assert.equal(await withTimeout(Promise.resolve(7), 50), 7);
  });

  it('searches and answers a 50-capture corpus locally in well under a second', async () => {
    const corpus = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        makeCapture({ id: `cap_bulk_${i}`, type: 'note', summary: `Bulk note ${i} about topic${i}` }),
      ),
    );
    const started = performance.now();
    const hits = await searchCaptures('topic7', corpus, 0.35);
    const answer = await buildAnswer('topic7', corpus, 0.35);
    const elapsed = performance.now() - started;
    assert.ok(hits.length >= 1);
    assert.equal(answer.notFound, false);
    assert.ok(elapsed < 250, `took ${elapsed.toFixed(0)} ms`);
  });
});

describe('date range filters', () => {
  const now = new Date(2026, 10, 20, 8, 0, 0);
  const at = (day: number, hour: number) =>
    new Date(2026, 10, day, hour, 0, 0).toISOString();

  it('filters by week, month, year and older', () => {
    assert.equal(matchesDateFilter(at(20, 7), 'week', now), true);
    assert.equal(matchesDateFilter(at(15, 7), 'week', now), true);
    assert.equal(matchesDateFilter(at(10, 7), 'week', now), false);
    assert.equal(matchesDateFilter(at(1, 7), 'month', now), true);
    assert.equal(matchesDateFilter(new Date(2026, 9, 30).toISOString(), 'month', now), false);
    assert.equal(matchesDateFilter(new Date(2026, 0, 5).toISOString(), 'year', now), true);
    assert.equal(matchesDateFilter(new Date(2025, 11, 31).toISOString(), 'year', now), false);
    assert.equal(matchesDateFilter(new Date(2025, 0, 1).toISOString(), 'older', now), true);
  });

  it('keeps all dates unfiltered and ignores malformed timestamps', () => {
    assert.equal(matchesDateFilter('nope', 'all', now), true);
    assert.equal(matchesDateFilter('nope', 'week', now), false);
    assert.equal(matchesDateFilter('nope', 'older', now), false);
  });
});

describe('entity approval and tag filter ordering', () => {
  it('classifies detected entities before they become tags', () => {
    assert.deepEqual(prepareEntityTag('  #Casa Nos  ', ['meeting']), {
      label: 'Casa Nos',
      state: 'add',
    });
    assert.deepEqual(prepareEntityTag('MEETING', ['meeting']), {
      label: 'MEETING',
      state: 'tagged',
    });
    assert.deepEqual(prepareEntityTag('123456', []), { label: '123456', state: 'sensitive' });
    assert.deepEqual(prepareEntityTag('x'.repeat(41), []), {
      label: 'x'.repeat(41),
      state: 'unusable',
    });
    assert.equal(prepareEntityTag('   ', []), null);
  });

  it('blocks sensitive entities using the existing detector', () => {
    const capture = { summary: 'wifi password note', derivedText: 'The wifi key is stored here' };
    assert.equal(prepareEntityTag('songhong2024', [], capture)?.state, 'sensitive');
    assert.equal(prepareEntityTag('849201', [], capture)?.state, 'sensitive');
    assert.equal(prepareEntityTag('cafe', [], capture)?.state, 'add');
    assert.equal(prepareEntityTag('wifi', [], capture)?.state, 'add');
    assert.equal(prepareEntityTag('password', [], capture)?.state, 'add');
    assert.equal(prepareEntityTag('mat khau', [], capture)?.state, 'add');
  });

  it('sorts tags by count, breaks ties alphabetically and pins the selected tag', () => {
    const options = [
      { tag: 'zeta', count: 1 },
      { tag: 'meeting', count: 9 },
      { tag: 'Casa', count: 9 },
      { tag: 'rare', count: 4 },
    ];
    const sorted = sortTagOptions(options, null);
    assert.deepEqual(sorted.map((o) => o.tag), ['Casa', 'meeting', 'rare', 'zeta']);
    const pinned = sortTagOptions(options, 'zeta');
    assert.deepEqual(pinned.map((o) => o.tag), ['zeta', 'Casa', 'meeting', 'rare']);
    assert.deepEqual(sortTagOptions(options, '__untagged__').map((o) => o.tag), [
      'Casa',
      'meeting',
      'rare',
      'zeta',
    ]);
  });
});

describe('desktop helpers', () => {
  it('formats storage estimates without inventing data', () => {
    assert.equal(formatBytes(0), '0 B');
    assert.equal(formatBytes(999), '999 B');
    assert.equal(formatBytes(1536), '1.5 KB');
    assert.equal(formatBytes(150 * 1024 * 1024), '150 MB');
    assert.equal(formatBytes(2.5 * 1024 * 1024 * 1024), '2.5 GB');
  });

  it('counts by type, pages and builds tag collections', async () => {
    const captures = [
      await makeCapture({ id: 'a', type: 'photo', summary: 'A', tags: ['x'], capturedAt: new Date(2026, 10, 21, 8).toISOString() }),
      await makeCapture({ id: 'b', type: 'voice', summary: 'B', tags: ['x'], capturedAt: new Date(2026, 10, 20, 22).toISOString() }),
      await makeCapture({ id: 'c', type: 'note', summary: 'C', capturedAt: new Date(2026, 10, 18, 12).toISOString() }),
    ];
    assert.deepEqual(countByType(captures), { all: 3, photo: 1, voice: 1, note: 1 });
    assert.deepEqual(paginate(captures, 0, 2), [captures[0], captures[1]]);
    assert.deepEqual(paginate(captures, 1, 2), [captures[0], captures[1], captures[2]]);
    assert.equal(navTarget(['a', 'b', 'c'], 'b', -1), 'a');
    assert.equal(navTarget(['a', 'b', 'c'], 'a', -1), null);
    assert.equal(navTarget(['a', 'b', 'c'], 'c', 1), null);
    const collections = tagCollections(captures);
    assert.equal(collections.length, 1);
    assert.equal(collections[0].tag, 'x');
    assert.equal(collections[0].count, 2);
    assert.equal(recentCaptures(captures, 2).length, 2);
    assert.equal(recentCaptures(captures, 2)[0].id, 'a');
  });

  it('copies only safe capture details', async () => {
    const capture = await makeCapture({
      id: 'copy',
      type: 'note',
      summary: 'Wifi note',
      entities: ['wifi', 'password'],
      derivedText: 'The password is secret123',
    });
    const text = buildCopyText(capture);
    assert.match(text, /Wifi note/);
    assert.match(text, /wifi/);
    assert.doesNotMatch(text, /secret123/);
    assert.doesNotMatch(text, /password/);
    assert.equal(askSuggestions('en').length, 2);
  });

  it('picks the inspected capture or falls back to the newest', async () => {
    const a = await makeCapture({ id: 'a', type: 'note', summary: 'A' });
    const b = await makeCapture({ id: 'b', type: 'note', summary: 'B' });
    assert.equal(pickInspected([a, b], 'b')?.id, 'b');
    assert.equal(pickInspected([a, b], 'missing')?.id, 'a');
    assert.equal(pickInspected([], 'a'), null);
  });
});

describe('local Ask suggestions', () => {
  it('generates questions only from real local data', async () => {
    assert.deepEqual(suggestQuestions([], 'en'), []);
    const expiry = await makeCapture({
      id: 'med',
      type: 'note',
      summary: 'Panadol box',
      entities: ['panadol'],
      expiryDate: '2027-03-01',
      capturedAt: new Date(2026, 10, 19).toISOString(),
    });
    const wifi = await makeCapture({
      id: 'wifi',
      type: 'note',
      summary: 'Wifi password note',
      entities: ['wifi', 'songhong2024'],
      derivedText: 'The wifi password is songhong2024',
    });
    const questions = suggestQuestions([expiry, wifi], 'en');
    assert.ok(questions.length > 0 && questions.length <= 5);
    assert.ok(questions.some((q) => /expire/i.test(q.question)));
    assert.ok(questions.some((q) => /wifi/i.test(q.question)));
    for (const q of questions) assert.doesNotMatch(q.question, /songhong2024/);
  });

  it('only adds a tag-total question when online', async () => {
    const a = await makeCapture({ id: 'a', type: 'note', summary: 'Lunch', tags: ['lunch'] });
    const b = await makeCapture({ id: 'b', type: 'note', summary: 'Lunch 2', tags: ['lunch'] });
    assert.equal(suggestQuestions([a, b], 'en', false).some((q) => /total/i.test(q.question)), false);
    assert.equal(suggestQuestions([a, b], 'en', true).some((q) => /total/i.test(q.question)), true);
  });

  it('produces Vietnamese questions and no hardcoded demo phrases', async () => {
    const demo = await makeCapture({ id: 'd', type: 'note', summary: 'Cafe menu', entities: ['cafe'] });
    const vi = suggestQuestions([demo], 'vi');
    assert.ok(vi.length > 0);
    assert.ok(vi.some((q) => /[à-ỹ]/i.test(q.question)));
    for (const q of suggestQuestions([demo], 'en')) {
      assert.doesNotMatch(q.question, /license plate|lunch receipt|mum's medicine/i);
    }
  });
});
