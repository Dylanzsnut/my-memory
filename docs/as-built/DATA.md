# My Memory — Data Architecture (As-Built)

- Owner: Duy · Last verified: 2026-11-18 · Against HEAD: `d7aa8d2`
- Executable schemas: `src/types.ts`, `src/lib/store.ts`, `firestore.rules`
- Design layer: `docs/DATA.md` (data classes, lifecycles, sync protocol). This
  file is the implementation snapshot; if the two disagree, the code wins and
  this file is corrected.

## 1. Logical model (technology-free)

    erDiagram
        ENT_CAPTURE ||--o{ ENT_CLAIM : cited_by
        ENT_CAPTURE ||--o| ENT_PROPOSAL : reviewed_by
        ENT_CAPTURE ||--o{ ENT_HUD_EVENT : observed_by

| Entity | Natural key | Single writer | Mutability | Lifecycle |
|---|---|---|---|---|
| ENT-001 Capture | `id` | `src/lib/store.ts` | mutable state | created → active → (proposed) → trashed → purged; or protected |
| ENT-002 ForgetProposal | `id` | `src/lib/store.ts` | mutable state | created → decided(approve\|keep) |
| ENT-003 HudEvent | `id` | `src/lib/store.ts` | append-only, capped | created → retained (max 60) → deleted |
| ENT-004 Settings | `key` | `src/lib/store.ts` | mutable state | language / onboardingDone / meta |

| ID | Must always hold | Verified by |
|---|---|---|
| INV-001 | A capture's original blob is never sent to Firestore or a cloud model | UNVERIFIED — no test yet |
| INV-002 | A trashed capture is excluded from search and answer sources | UNVERIFIED — no test yet |
| INV-003 | A protected capture is never proposed | UNVERIFIED — no test yet |
| INV-004 | A shown answer has at least one verified claim | UNVERIFIED — no test yet |

State rules: `retentionState` is `active | proposed | trashed | protected`.
`trashedAt` records the transition; `purgeAt` records the recoverable-window end.
Only a human decision may move `active` to `trashed`.

Derived data: `embedding` is derived from summary + entities + user tags + derived text and
rebuilt locally when a capture is created or tagged. `sourceMatch` is derived from the last
answer. A claim is derived from an answer and checked against its cited capture. `suggestedTags`
are derived locally from cosine similarity grouping and never synced (`docs/as-built/specs/auto-tagging.md`).

## 2. Physical schema & key-prefix catalog

| Store | Engine | Key | Value | Notes |
|---|---|---|---|---|
| captures | IndexedDB | `id` | `CaptureRecord` incl. Blob/DataURL original | index `by-date` on `capturedAt` |
| proposals | IndexedDB | `id` | `ForgetProposal` | no index |
| hud | IndexedDB | `id` | `HudEvent` | trimmed above 60 entries |
| meta | IndexedDB | `key` | `{key, value}` | `activeAuthSession` plus `${uid}::*` per-user settings (`language`, `onboardingDone`, `dismissedTagGroups`) |
| captures | Firestore | `/users/{uid}/captures/{id}` | metadata fields only | opt-in, Google accounts only; demo records skipped (`INV-302`) |

Firestore field allowlist in `syncCaptureMetadata`: `id`, `type`, `capturedAt`,
`summary`, `entities`, `expiryDate`, `language`, `inferenceSource`,
`retentionState`. No `originalRef`, `audioBlob`, `derivedText`, `embedding`,
`sourceMatch`, `protectedReason`, `tags`, `suggestedTags`, timestamps of purge, or demo records.

## 3. Query-to-index matrix

| Index | Store | Definition | Serves | Cost |
|---|---|---|---|---|
| IDX-001 | captures | `by-date` on `capturedAt` | reverse-chronological feed | one index write per capture |

Local semantic search is a full in-memory scan over `captures`; it is bounded by
personal-corpus size and has no vector index at HEAD.

## 4. Lineage

| Store | Class | Derived from | Rebuild |
|---|---|---|---|
| captures.embedding | derived | summary + entities + derived text | `embed()` on capture creation |
| captures.sourceMatch | derived | last answer's cited capture | `buildAnswer()` |
| claims | derived | generated answer text | `parseClaims()` |
| hud | derived | inference calls | `App.log()` |

## 5. Retention, compaction & migration safety

- Trash retention target belongs to REQ-005; see `docs/as-built/specs/forgetting.md`.
- HUD events are trimmed above 60 entries in IndexedDB.
- No schema migration exists; IndexedDB version is `1`.
- PII: demo seed values are synthetic, tagged `demo: true`, and partitioned in `ownerUid: 'demo'`. Google sign-in runs a one-time cleanup (`cleanupDemoRecordsForUser`) removing any unowned or stray `demo: true` records, proposals, and HUD events before loading memory, and never calls `seedDemoCaptures()`. Real capture content stays local at HEAD.
