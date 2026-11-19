# Spec: storage layout

- Owning module: `src/lib/store.ts` · Depth: STANDARD
- Related: ADR-001, REQ-003
- Owner: Duy · Last verified: 2026-11-18 · Against HEAD: `d7aa8d2`

## 1. Invariants

| ID | Must always hold | Verified by |
|---|---|---|
| INV-301 | Originals are stored in IndexedDB, not Firestore | UNVERIFIED — no test yet |
| INV-302 | Demo records are skipped by Firestore sync | UNVERIFIED — no test yet |
| INV-303 | A sync failure never blocks a capture | UNVERIFIED — no test yet |
| INV-304 | Only `DateTimeOriginal` (`0x9003`) is read from EXIF (`src/lib/exif.ts`); GPS and device-identifying EXIF fields are never stored or synced | UNVERIFIED — no test yet |

## 2. Layout

IndexedDB database `my-memory`, version `1`, stores `captures`, `proposals`,
`hud`, `meta`. Key paths and the `by-date` index are in `src/lib/store.ts`,
which is the executable source of truth. Firestore metadata path is
`/captures/{id}` when sync is enabled; the field allowlist is in
`syncCaptureMetadata`.

## 3. Lifecycle

Captures are written once on capture and updated on source-match, forget
decision, restore or purge. HUD events are trimmed above 60. Meta values are
small key/value rows.

## 4. Edge cases

- IndexedDB unavailable: no fallback store exists; this is a known limit.
- Firestore sync disabled: app works fully local.
- Two tabs: `persistentMultipleTabManager()` is configured for Firestore cache.
