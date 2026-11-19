# Spec: forgetting

- Owning module: `src/lib/forget.ts` · Depth: DEEP
- Related: ADR-005, REQ-004, REQ-005
- Owner: Duy · Last verified: 2026-11-18 · Against HEAD: `d7aa8d2`

## 1. Invariants

| ID | Must always hold | Verified by |
|---|---|---|
| INV-201 | `scanForProposals` never mutates captures | UNVERIFIED — no test yet |
| INV-202 | Protected captures are excluded from proposals | UNVERIFIED — no test yet |
| INV-203 | The earlier capture in a duplicate pair is never the proposed one | UNVERIFIED — no test yet |
| INV-204 | `active → trashed` requires a recorded human decision | UNVERIFIED — no test yet |

## 2. Rules at HEAD

- F1 Duplicate: cosine similarity at or above `duplicateThreshold`, same type,
  later capture proposed.
- F2 Expired: the capture's own `expiryDate` has passed.
- F4 Protection: `protectedReason` excludes a capture from proposals.
- `applyDecision(capture, decision, retentionDays)` sets `trashedAt` and
  `purgeAt` for approve; keep leaves the capture active.

## 3. Manual deletion & purge at HEAD

- **AI never deletes on its own.** Proposal generation remains advisory (`INV-201`..`INV-204`).
- Owners can manually delete one capture at a time from `Memories` (card `⋮` menu) or `DetailSheet` (confirmation dialog; stronger warning if `protectedReason` is set), moving it to the 30-day `Trash` screen (`trashSource: 'manual'`), closing pending proposals, and showing a 5-second undo toast.
- **Unified Delete (`REQ-005`):** neither `Memories` nor `DetailSheet` offers immediate permanent deletion; every delete enters the 30-day recoverable `Trash` first.
- **Dedicated `Trash` screen** (`src/components/Trash.tsx`) lists days remaining, allows **Restore**, and is the only surface that supports **Delete permanently** (with confirmation; removes blobs from IndexedDB and deletes Firestore metadata when sync is enabled).
- **App-open purge (explicit exception):** On app open, `purgeExpiredTrash()` removes trashed captures whose `purgeAt <= now`, and shows a toast summary if items were purged.

## 4. Failure behavior

A malformed `expiryDate` is ignored. Threshold values come from env / Remote
Config; the human-approval rule is code, not config.
