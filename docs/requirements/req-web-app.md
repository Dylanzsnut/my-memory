# Requirements: Web companion

- Owner: Duy · Last verified: 2026-11-18 · Against HEAD: `d7aa8d2`

## REQ-001 — Zero-effort multi-type capture

- Statement: A signed-in user can create a photo (via camera or multi-select gallery import), voice or note capture without naming or filing it.
- Type: functional · Priority: must
- Source: OUT-1
- Acceptance: one action creates a `CaptureRecord` (or sequential batch queue for multi-select import with visible progress); no folder/tag/title prompt appears; photo imports derive `capturedAt` from EXIF `DateTimeOriginal` → `file.lastModified` → import time without storing GPS or device-identifying EXIF fields (`INV-304`).
- Implemented by: `src/components/Memories.tsx`, `src/lib/exif.ts`, `src/lib/ai.ts`
- Verified by: UNVERIFIED — no test yet

## REQ-002 — Cited answer or refusal

- Statement: Every factual answer carries a capture id that resolves locally; otherwise the app says "Not found".
- Type: functional · Priority: must
- Source: OUT-2, CON-2
- Acceptance: all rendered claims have `Claim.verified === true`; zero uncited factual claims; local search honors user-authored `tags` (never unaccepted `suggestedTags`).
- Implemented by: `src/lib/answer.ts`, `src/lib/search.ts`, `src/lib/tags.ts`
- Verified by: UNVERIFIED — no test yet

## REQ-003 — Local-first offline operation

- Statement: Capture, local search, user-owned tagging/grouping, and cached answers work after first load without a network connection.
- Type: non-functional · Priority: must
- Source: OUT-3, CON-2
- Acceptance: offline reload returns the app shell and the local index; cloud synthesis reports that it needs a connection; user-owned `tags` and `suggestedTags` run locally and never leave the device (`INV-401`, `INV-402`).
- Implemented by: `src/lib/store.ts`, `src/lib/embeddings.ts`, `src/lib/tags.ts`, `public/sw.js`
- Verified by: UNVERIFIED — no automated offline run yet

## REQ-004 — Human-controlled forgetting

- Statement: The model proposes forget candidates; only an explicit human decision changes retention. Protected captures are excluded from proposals.
- Type: functional · Priority: must
- Source: OUT-4, CON-2
- Acceptance: every `retentionState` transition from `active` to `trashed` has a recorded decision; no proposal targets a protected capture.
- Implemented by: `src/lib/forget.ts`
- Verified by: UNVERIFIED — no test yet

## REQ-005 — Manual deletion with recovery

- Statement: A user can delete one memory at a time; deletion enters a recoverable trash. Permanent removal happens only from the trash, when the recovery window ends on app open, or via explicit two-step "Delete permanently now" in `DetailSheet` (documented exception).
- Type: functional · Priority: must
- Source: OUT-4
- Acceptance: recovery window target is **30 days**; permanent removal deletes the metadata document (`deleteCaptureMetadata`) and local blobs (`deleteCapture`).
- Implemented by: `src/components/Trash.tsx`, `src/components/DetailSheet.tsx`, `src/components/Memories.tsx`, `src/lib/forget.ts`, `src/App.tsx`
- Verified by: UNVERIFIED — code + build checked; automated tests added in P2

## REQ-006 — Mandatory Google sign-in

- Statement: Access to the app requires Google sign-in; local data is partitioned by the authenticated `uid`.
- Type: functional · Priority: must
- Source: product decision in `plan/tasks.md`
- Acceptance: no guest mode; user A cannot read user B's captures; sign-out preserves local data.
- Implemented by: planned — see `plan/tasks.md`
- Verified by: UNVERIFIED — not implemented at HEAD

## REQ-007 — Runtime hybrid inference

- Statement: Firebase AI Logic is called at runtime with explicit inference modes and provenance labels.
- Type: non-functional · Priority: must
- Source: CON-1, CON-3
- Acceptance: `ONLY_ON_DEVICE` extraction, `PREFER_ON_DEVICE` short answer, `ONLY_IN_CLOUD` synthesis; `InferenceSource` comes from the SDK or is `SIMULATED`.
- Implemented by: `src/lib/ai.ts`, `src/lib/firebase.ts`
- Verified by: UNVERIFIED — no live smoke-test log yet
