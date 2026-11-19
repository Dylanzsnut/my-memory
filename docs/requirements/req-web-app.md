# Requirements: Web companion

- Owner: Duy · Last verified: 2026-11-18 · Against HEAD: `d7aa8d2`

## REQ-001 — Zero-effort multi-type capture

- Statement: A signed-in user can create a photo (via camera or multi-select gallery import), voice or note capture without naming or filing it.
- Type: functional · Priority: must
- Source: OUT-1
- Acceptance: one action creates a `CaptureRecord`; no folder/tag/title prompt appears. A single **Photo** action opens the platform picker (camera or gallery/file) and accepts multiple images through a sequential batch queue with visible progress; it sets `capturedAt` from EXIF `DateTimeOriginal` → `file.lastModified` → import time and reads no other EXIF field (no GPS or device-identifying data, `INV-304`). Captures may be organised into local-only editable groups (`ENT-005`): rename, split a selection into a new named group, move a capture, or delete a group while keeping all its captures; date is a filter, not a group key.
- Implemented by: `src/components/Memories.tsx`, `src/lib/exif.ts`, `src/lib/groups.ts`, `src/lib/store.ts`, `src/lib/ai.ts`
- Verified by: Verified (unit) for EXIF parsing and group edit helpers in `tests/core.test.ts`; physical mobile Chrome gallery import and group interactions still need a manual device check.

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
- Acceptance: offline reload returns the app shell and the local index; cloud synthesis reports that it needs a connection; user-owned `tags` and `suggestedTags` and editable `MemoryGroup` records run locally and never leave the device (`INV-401`, `INV-402`); auto re-clustering never overwrites manual group edits.
- Implemented by: `src/lib/store.ts`, `src/lib/embeddings.ts`, `src/lib/tags.ts`, `src/lib/groups.ts`, `public/sw.js`
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

## REQ-006 — Mandatory Google sign-in & partitioned Demo mode

- Statement: Access passes through the sign-in gate (`SignInGate`); Google sign-in partitions local data by authenticated `uid` with an empty initial memory, while an explicit Demo mode option loads synthetic judging data in an isolated `'demo'` namespace.
- Type: functional · Priority: must
- Source: product decision in `plan/tasks.md`
- Acceptance: no silent guest fallback; Google login cleans stray demo records and starts empty; user A cannot read user B's captures; sign-out preserves local data; Demo records never sync to Firestore (`INV-302`).
- Implemented by: `src/components/SignInGate.tsx`, `src/lib/firebase.ts`, `src/lib/store.ts`, `firestore.rules`, `src/App.tsx`
- Verified by: UNVERIFIED — code + build verified; live Google OAuth + cross-user rules check requires Firebase Console setup

## REQ-007 — Runtime hybrid inference

- Statement: Firebase AI Logic is called at runtime with explicit inference modes and provenance labels.
- Type: non-functional · Priority: must
- Source: CON-1, CON-3
- Acceptance: `ONLY_ON_DEVICE` extraction, `PREFER_ON_DEVICE` short answer, `ONLY_IN_CLOUD` synthesis; `InferenceSource` comes from the SDK or is `SIMULATED`.
- Implemented by: `src/lib/ai.ts`, `src/lib/firebase.ts`
- Verified by: UNVERIFIED — no live smoke-test log yet
