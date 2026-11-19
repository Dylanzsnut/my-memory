# My Memory — Data design

One sentence: one local store holds three capture types with their originals,
derived indexes and human decisions; only a small metadata allowlist may ever
reach Firestore, and nothing is deleted without a recorded human decision.

- Owner: Duy
- Last verified: 2026-11-18
- Against HEAD: `714bb08`
- Status: design authority (design intent, marked `Claimed`); implementation facts live in `docs/as-built/DATA.md`
- Executable schemas: `src/types.ts`, `src/lib/store.ts`, `src/lib/firebase.ts`, `firestore.rules`
- Requirements: `REQ-001` … `REQ-007` in `docs/requirements/req-web-app.md`
- Decisions: `ADR-001` … `ADR-009` in `docs/adr/`
- Split trigger: ~800 lines

## 0. Scope and authority

This document owns the **data design**: classification, semantics, lifecycles,
partitioning, sync protocol, retention and evolution rules. It does not own
today's implementation state.

| Fact type | Owner | This doc's role |
|---|---|---|
| Field shapes, keys, DDL | `src/types.ts`, `src/lib/store.ts`, `contracts/README.md` | links only, never retypes as authority |
| What is true at HEAD | `docs/as-built/DATA.md` | points to it; never contradicts it |
| Requirement text and acceptance | `docs/requirements/req-web-app.md` | cites `REQ-` IDs |
| Decisions and rationale | `docs/adr/` | cites `ADR-` IDs |
| Pending behaviour | `docs/plan/tasks.md` | cites the task; stays labelled *planned* |

Rule of no duplicate SSOT: if a fact appears both here and in an as-built or
executable source, the executable source wins and this file must be corrected.

## 1. Data classes and privacy classification

Every stored value belongs to exactly one class. The class decides where the
value may live and whether it may leave the device (`REQ-003`, `ADR-004`).

| Class | Name | Examples | Storage | Leaves device? | Authority |
|---|---|---|---|---|---|
| C1 | Original evidence | photo data URL, `audioBlob`, note text | IndexedDB `captures` | **Never** | `INV-001`, `INV-301`, `ADR-004` |
| C2 | Derived index | `embedding`, `derivedText` (OCR/ASR) | IndexedDB `captures` | **Never** | `INV-001`, `ADR-009` |
| C3 | Structured metadata | `summary`, `entities`, `expiryDate`, `type`, `capturedAt`, `language` | IndexedDB + Firestore allowlist | Yes, allowlist only | `REQ-003`, `ADR-004` |
| C4 | Operational telemetry | `HudEvent`, inference errors | IndexedDB `hud` | No | `ADR-008` |
| C5 | Configuration and state | `meta` keys, `AppSettings`, Remote Config values | IndexedDB `meta` + remote | No | `src/lib/config.ts` |
| C6 | Provenance labels | `inferenceSource` (`ON_DEVICE` / `IN_CLOUD` / `SIMULATED`) | with the record | Label syncs with C3 | `ADR-008`, `INV-104` |
| C7 | Human decisions | `ForgetProposal.decided`, `trashedAt`, `purgeAt` | IndexedDB | `retentionState` syncs, decision detail does not | `REQ-004`, `REQ-005` |
| C8 | User-authored labels | `tags` | IndexedDB `captures` | **Never** — explicitly excluded from the sync allowlist (`INV-401`) | `src/lib/tags.ts`, `docs/as-built/specs/auto-tagging.md` |

Boundary summary (`Claimed`, see `docs/ARCHITECTURE.md` §3): originals,
transcripts and embeddings are device-resident by construction, not by policy
alone — they are excluded from the Firestore write path in
`syncCaptureMetadata` and cannot be produced by any API in this codebase.

## 2. Entity model (logical)

| Entity | Natural key | Single writer | Mutability | Lifecycle |
|---|---|---|---|---|
| ENT-001 Capture | `id` | `src/lib/store.ts` | mutable state, immutable original | created → active → (proposed) → trashed → purged; or protected |
| ENT-002 ForgetProposal | `id` | `src/lib/store.ts` | mutable state | created → decided(`approve` \| `keep`) |
| ENT-003 HudEvent | `id` | `src/lib/store.ts` | append-only, capped | created → retained (max 60) → deleted |
| ENT-004 Settings | `key` | `src/lib/store.ts` | mutable state | language / onboardingDone / auth mode / meta |
| ENT-005 MemoryGroup | `id` | `src/lib/store.ts` | user-editable, local-only | auto-created → (rename/split/move → manual) → deleted (captures kept) |

ENT-001…005 are the complete set at HEAD. Identity is carried by `ownerUid` on
records rather than a separate user entity (see §6). `MemoryGroup` fields:
`id`, `name`, `captureIds`, `source: 'auto' \| 'manual'`, `createdAt`,
`updatedAt`, `ownerUid?`. A capture with `manualGroupLock` is skipped by auto
reconciliation.

## 2.1 Attribute dictionary — ENT-001 Capture

Semantics table; `src/types.ts` (`CaptureRecord`) is the executable shape.

| Attribute | Type | Class | Mutability | Source of truth | May sync (C3 allowlist) | Notes |
|---|---|---|---|---|---|---|
| `id` | string | C3 | immutable | store | yes | citation target |
| `type` | `photo \| voice \| note` | C3 | immutable | capture time | yes | `REQ-001` |
| `capturedAt` | ISO string | C3 | immutable | capture time; EXIF `DateTimeOriginal` (`0x9003`) for imported photos, fallback `file.lastModified` → import time | yes | index `by-date` (`INV-304`) |
| `summary` | string | C3 | mutable via re-extraction | model extraction | yes | index only, never replaces original |
| `entities` | string[] | C3 | mutable via re-extraction | model extraction | yes | sensitive values need consent before cloud use (P1) |
| `expiryDate` | string \| null | C3 | mutable via re-extraction | captured content only | yes | `F2`: never inferred |
| `language` | `en \| vi` | C3 | mutable | capture / user | yes | `ADR-007` |
| `inferenceSource` | `ON_DEVICE \| IN_CLOUD \| SIMULATED` | C6 | immutable per response | SDK response | yes | never guessed; unknown → `SIMULATED` |
| `retentionState` | `active \| proposed \| trashed \| protected` | C3/C7 | by transitions only (§3) | human decisions | yes | `INV-204` |
| `originalRef` | string (blob/data URL) | C1 | immutable | capture | **no** | read-only evidence |
| `audioBlob` | Blob | C1 | immutable | `MediaRecorder` | **no** | voice original |
| `audioMimeType` | string | C1 | immutable | recorder | **no** | |
| `derivedText` | string | C2 | user-correctable | OCR/ASR or user | **no** | correcting it never mutates the original |
| `embedding` | number[] | C2 | rebuildable | `embed()` | **no** | local lexical fallback at HEAD (`ADR-009`) |
| `sourceMatch` | `{score, captureId}` | C2 | derived | `buildAnswer()` | **no** | last answer provenance |
| `protectedReason` | string | C3 | set at creation | deterministic rule | **no** | `F4`, `INV-003` |
| `trashedAt` | ISO string | C7 | set on trash | human decision | no (state only) | transition timestamp |
| `purgeAt` | ISO string | C7 | derived from `trashedAt` | `trashRetentionDays` | no (state only) | end of recoverable window (`REQ-005`) |
| `demo` | boolean | C3 | immutable | seeding | **no** (skipped) | `INV-302`; demo data is never real user data |
| `tags` | string[] | C8 | mutable, user-authored | the user | **no** | survives re-extraction; joins the search index (`INV-401`) |
| `suggestedTags` | string[] | C2 | accept / rename / dismiss | embedding grouping | **no** | proposals only; never written without Accept (`INV-402`) |

## 2.2 Attribute dictionary — ENT-002 / ENT-003 / ENT-004

| Entity · attribute | Type | Class | Mutability | Notes |
|---|---|---|---|---|
| Proposal · `id` | string | C7 | immutable | |
| Proposal · `captureId` | string | C7 | immutable | target capture |
| Proposal · `reason` | `duplicate \| expired` | C7 | immutable | `F1` / `F2`; `superseded` reserved, unscored in v1 (`F3`) |
| Proposal · `evidence` | string | C7 | immutable | human-readable reason |
| Proposal · `score` | number? | C7 | immutable | measurable similarity evidence |
| Proposal · `relatedCaptureId` | string? | C7 | immutable | earlier capture in a duplicate pair (`INV-203`) |
| Proposal · `createdAt` | ISO string | C7 | immutable | |
| Proposal · `decided` | `approve \| keep`? | C7 | once, by human | `INV-204`; a *keep* is curator feedback |
| HudEvent · `id` / `at` / `label` / `source` / `latencyMs` / `detail?` | — | C4 | append-only | `ADR-008`: HUD is evidence, not decoration |
| Settings · `onboardingDone` | boolean | C5 | mutable | |
| Settings · `language` | `en \| vi` | C5 | mutable | English-first (AGENTS §3) |
| Settings · `duplicateThreshold` | number | C5 | mutable (Remote Config) | scoring only, never the rules |
| Settings · `retrievalThreshold` | number | C5 | mutable (Remote Config) | never silently lowered (`G3`) |
| Settings · `trashRetentionDays` | number | C5 | mutable (Remote Config) | owns the `purgeAt` window (`REQ-005`) |
| Settings · `cloudModel` | string | C5 | mutable (Remote Config) | name only; substitution stays labelled |

## 3. State machines

### 3.1 Capture retention lifecycle

```
                 create
                   │
                   ▼
              ┌─────────┐  F4 protected (health/safety, unique)
              │ active  │──────────────────────────────►┌──────────┐
              └─────────┘                              │ protected │
                   │  ▲                                └──────────┘
     scan F1/F2    │  │ keep (human)                           │
                   ▼  │                                        │ manual delete
             ┌───────────┐                                     │ (strong confirm)
             │ proposed  │── approve (human) ──►┌─────────┐◄───┘
             └───────────┘                      │ trashed │
                                                └─────────┘
                                                     │  restore (human)
                                                     │◄──────────
                                                     │
                                    at `purgeAt` (app open) ──► purged
```

| Transition | Trigger | Who | Guard |
|---|---|---|---|
| create → active | capture | user | schema validated |
| active → proposed | `scanForProposals` | code, **proposal only** | `F1`/`F2` evidence required (`INV-201`) |
| proposed → active | keep | human | recorded decision, feeds curator |
| proposed → trashed | approve | human | recorded decision (`INV-204`) |
| active → trashed (manual delete) | delete action | human | confirmation; recorded via `trashSource: 'manual'`, not *proposal approved* |
| any → protected | `protectedReason` set | deterministic rule | never proposed regardless of score (`F4`, `INV-003`) |
| trashed → active | restore | human | before `purgeAt` |
| trashed → purged | `purgeAt` reached | app open, user-visible (`purgeExpiredTrash`) | documented exception to "no background deletion"; still human-scheduled |
| active → purged (delete permanently now) | `DetailSheet` action | human | stronger second confirmation; recorded as a distinct decision; explicit documented exception to the `REQ-005` recoverable window; never offered in bulk |

Invariant `F5`: every transition to `trashed` requires a recorded human decision
and stays recoverable for the `REQ-005` window. There is no auto-delete path,
no bulk approval and no background job that bypasses a decision.

### 3.2 Proposal lifecycle

created → decided(`approve`) → capture moves to `trashed`
created → decided(`keep`) → capture stays `active`, score is feedback
created → (target deleted manually) → proposal closed (`decided: 'manual'`) or deleted on purge

## 4. Physical storage design

### 4.1 IndexedDB (device, `src/lib/store.ts`)

Database `my-memory`, version `2`, single writer (`Claimed`, `INV-301`).

| Object store | Key | Key path | Index | Value | Notes |
|---|---|---|---|---|---|
| `captures` | `id` | `id` | `by-date` on `capturedAt` | `CaptureRecord` (incl. C1 blobs) | feed order, search corpus |
| `proposals` | `id` | `id` | — | `ForgetProposal` | |
| `hud` | `id` | `id` | — | `HudEvent` | trimmed above 60 entries |
| `meta` | `key` | `key` | — | `{key, value}` | `language`, `onboardingDone`, `activeAuthSession`, `${uid}::*` settings |
| `groups` | `id` | `id` | — | `MemoryGroup` | local-only; never synced to Firestore |

Design consequences (all `Claimed`):

- One index only (`IDX-001`); semantic search is an in-memory scan over
  `captures`, bounded by a personal corpus. A vector index is not required at
  this scale and is not built at HEAD.
- C1 blobs dominate storage. `audioBlob` is stored as a `Blob` (structured
  clone), photos as data/blob URLs in `originalRef`. Capacity planning assumes
  thousands of captures, not millions.
- There is no schema migration at HEAD (`docs/as-built/DATA.md` §5). See §11.

### 4.2 Firestore (cloud, metadata only)

| | At HEAD | Planned |
|---|---|---|
| Path | `/captures/{id}` | `/users/{uid}/captures/{id}` |
| Write | `setDoc` in `syncCaptureMetadata` | same, keyed by `uid` |
| Access | `firestore.rules` deny-all + quoted per-user template | per-user `request.auth.uid == uid` |
| Gate | `VITE_ENABLE_FIRESTORE_SYNC === 'true'` (default off) | + Auth active + rules deployed |

Allowlist (`Claimed` — executable source is `syncCaptureMetadata`):
`id`, `type`, `capturedAt`, `summary`, `entities`, `expiryDate`, `language`,
`inferenceSource`, `retentionState`.

Never written: `originalRef`, `audioBlob`, `audioMimeType`, `derivedText`,
`embedding`, `sourceMatch`, `protectedReason`, `trashedAt`, `purgeAt`, `tags`,
`suggestedTags`, `demo` records (`INV-302`). User-authored tag text never
leaves the device. Failure semantics: a sync error is caught and logged, and
never blocks a capture (`INV-303`).

## 5. Derived data and lineage

| Store | Class | Derived from | Rebuild | Failure rule |
|---|---|---|---|---|
| `embedding` | C2 | `summary` + `entities` + `derivedText` | `embed()` at capture creation | never invents content |
| `sourceMatch` | C2 | last answer's cited capture | `buildAnswer()` | absent when no answer |
| claims | C2 | generated answer text | `parseClaims()` | unverifiable claim is dropped (`G1`) |
| `hud` | C4 | inference calls | `App.log()` | capped at 60 |

Rules: the original is read-only; derived text is an index that the user may
correct without mutating the original (AGENTS invariant 7). The embedder is
pinned to EmbeddingGemma 2 as the production target; the Web build's local
lexical fallback is an explicit, labelled deviation (`ADR-009`), not a silent
substitution.

## 6. Identity, tenancy and partitioning (planned)

`docs/plan/tasks.md` § "Mandatory Google sign-in" and § "Auth modes: Google vs
demo". Nothing in this section exists at HEAD; it is design for the planned
partition so storage changes can be made once.

| Mode | Identity | Local namespace | Seeded data | Firestore |
|---|---|---|---|---|
| `google` | Firebase Auth `uid` | `/users/{uid}` scope in IndexedDB | none — always starts empty | opt-in, per-user rules |
| `demo` | synthetic local id (e.g. `demo`) | own namespace | `SEED_ITEMS`, all `demo: true` | **never**, even when sync is on |

Design rules:

- Partition IndexedDB by `uid` (planned key prefix or per-user stores); signing
  out must not delete local data, switching accounts must not mix data.
- A Google session never seeds demo data, and any leftover `demo: true`
  records (with their proposals and HUD events) are cleared before memory
  loads. This is a one-time cleanup per account, user-visible and recorded.
- `VITE_SEED_DEMO` becomes explicit opt-in (default off) so an unset env var can
  never seed a real account.

## 7. Sync protocol and privacy boundary

1. Preconditions: sync enabled in config **and** Auth active **and** per-user
   rules deployed. Any missing precondition means the write path is skipped.
2. Selection: captures where `demo` is set are skipped (`INV-302`); trashed and
   protected captures follow `retentionState` in the allowlist only.
3. Payload: the C3 allowlist and nothing else. No blob, transcript, embedding,
   tag text (`tags`/`suggestedTags`) or decision detail ever leaves the device.
4. Failure: caught, logged to console, never throws into the capture path
   (`INV-303`). There is no retry queue at HEAD.

The boundary is data, not latency: the cloud answer path receives JSON
summaries of selected captures and must return claims the device re-attaches to
local captures (`REQ-007`, `INV-103`).

## 8. Retention, trash and purge

| Data | Retention | Rule |
|---|---|---|
| C1/C2 capture data | until a human deletes it | no automatic expiry (`F5`) |
| Trashed capture | `trashRetentionDays` (default 30, `REQ-005`) | `purgeAt = trashedAt + window`; restore before then |
| Purged capture | removed from IndexedDB | on app open (`purgeExpiredTrash`), user-visible exception, or explicit permanent delete |
| `HudEvent` | last 60 | trimmed on write |
| Proposal | until decided | closed (`decided: 'manual'`) or deleted when target is deleted |
| Firestore metadata | until permanent deletion | document deleted via `deleteCaptureMetadata` when capture is purged |

Protected captures are still deletable, but only with a stronger confirmation;
`F4` protects them from *proposals*, not from their owner.

## 9. Search and retrieval data design

| Index | Store | Definition | Serves | Cost |
|---|---|---|---|---|
| IDX-001 | captures | `by-date` on `capturedAt` | reverse-chronological feed | one index write per capture |

Retrieval runs over `embedding` cosine similarity plus lexical match on
`summary` + `entities` + `tags` + `derivedText`, with bilingual
EN/VI synonyms (`ADR-007`). Thresholds are configuration, never rules: `retrievalThreshold`
gates whether an answer may be shown at all (`G3`: below threshold returns
"Not found" and the threshold is never silently lowered), and
`duplicateThreshold` gates `F1` proposals.

Deleted (trashed) captures are excluded from search and answer sources
(`INV-002`) and are never sent to the cloud.

### 9.1 Tagging, grouping and suggestions

Implemented in `src/lib/tags.ts` (spec `docs/rfc/003-auto-tagging-flow.md`,
as-built `docs/as-built/specs/auto-tagging.md`). Three layers with distinct ownership:

| Layer | Owner | Written when | Re-extraction |
|---|---|---|---|
| `entities` | model | extraction | may rewrite; never user-edited |
| `tags` | user | explicit add/remove | never touched |
| `suggestedTags` | embedding grouping | proposal only | recomputed as groups change |

Grouping is local: cluster captures by cosine similarity over `embedding`
(connected components over a threshold), then derive a candidate label per
group from shared keywords — offline, no model call required. The suggestion UI
offers Accept (write `tags` to the chosen captures), Rename, or Dismiss. There
is no automatic write path: the same rule as Forget applies — the model
proposes, the human disposes (`F5`).

## 10. Configuration sources

| Source | Keys | May change | May never change |
|---|---|---|---|
| `.env` / `src/lib/config.ts` | `VITE_FIREBASE_*`, `VITE_RECAPTCHA_SITE_KEY`, `VITE_SEED_DEMO`, `VITE_ENABLE_FIRESTORE_SYNC`, thresholds, models | defaults | — |
| Remote Config | `cloud_model`, `duplicate_threshold`, `retrieval_threshold`, `trash_retention_days` | tunables | citation rule, `F4` protections, `F5` approval rule, model pins (only names are configurable) |
| `meta` store | `language`, `onboardingDone`, planned `authMode`/`uid` | user state | — |

## 11. Schema evolution and migration policy

Current state: IndexedDB version `2` (v2 added the `groups` store additively;
v1 records are untouched). `manualGroupLock` on captures defaults to absent.

Rules for future version bumps (design intent, `Claimed`):

1. Bump the `openDB` version and add an `upgrade` handler; never write to stores
   before the upgrade completes.
2. Additive first: add fields with safe defaults and new stores; do not
   repurpose or rename existing keys in the same step.
3. Never delete or rewrite C1 originals in a migration. If a migration cannot
   preserve an original, it must abort instead.
4. Backfill derived data (`embedding`, `derivedText`) by rebuild, not copy.
5. Record each migration in `docs/as-built/DATA.md` §5 with the version number
   and the class of data touched.

Additive optional fields (`tags`, `suggestedTags`, `manualGroupLock`, `ownerUid`)
follow rule 2 and must be read with safe defaults so pre-existing records stay
valid. Identity partitioning (§6) uses `ownerUid` in place of a version bump.

## 12. Data quality, correction and provenance

- Extraction is schema-constrained (`Extraction` in `src/types.ts`); the model
  never writes a record without validation (`ExtractionRequest` → `ExtractionResult`).
- `expiryDate` comes from the capture or is `null`; it is never inferred (`F2`).
- Every record carries `inferenceSource`; an unknown or missing SDK provenance
  becomes `SIMULATED` (`INV-104`), and `SIMULATED` is never presented as a real
  model run. Demo seed records are `SIMULATED` by construction.
- A user correction writes to `derivedText`, never to `originalRef`/`audioBlob`.

## 13. Invariants and verification map

Invariants are listed in their owning specs; this table maps design rules to
them so nothing is defined twice.

| Design rule (this doc) | Invariant | Verified by |
|---|---|---|
| C1 never leaves the device | `INV-001`, `INV-301` | `docs/as-built/VERIFICATION.md` — UNVERIFIED, no test yet |
| Trashed excluded from retrieval | `INV-002` | UNVERIFIED |
| Protected never proposed | `INV-003`, `INV-202` | UNVERIFIED |
| Answer requires a verified claim | `INV-004` | UNVERIFIED |
| Human-only transitions to trash | `INV-204` | UNVERIFIED |
| Proposal never mutates a capture | `INV-201` | UNVERIFIED |
| Earlier capture never proposed | `INV-203` | UNVERIFIED |
| Extraction `ONLY_ON_DEVICE` | `INV-101`, `INV-102` | UNVERIFIED |
| Cloud synthesis summaries only | `INV-103` | UNVERIFIED |
| Unknown provenance → `SIMULATED` | `INV-104` | UNVERIFIED |
| Demo data never synced | `INV-302` | UNVERIFIED |
| Sync failure never blocks capture | `INV-303` | UNVERIFIED |
| EXIF reads `DateTimeOriginal` only (no GPS/device tags) | `INV-304` | UNVERIFIED |

No automated test suite exists at HEAD; every row is `UNVERIFIED` until a run
is recorded. The plan's search/answer test set and the CSD's 20-question set
are still unextracted (tracked in `docs/plan/tasks.md`).

## 14. Related docs

`docs/README.md`, `docs/ARCHITECTURE.md`, `docs/as-built/DATA.md`,
`docs/as-built/specs/storage-layout.md`, `docs/as-built/specs/forgetting.md`,
`docs/as-built/specs/inference-boundaries.md`, `docs/rfc/003-auto-tagging-flow.md`,
`docs/requirements/req-web-app.md`, `docs/plan/tasks.md`, `contracts/README.md`.
