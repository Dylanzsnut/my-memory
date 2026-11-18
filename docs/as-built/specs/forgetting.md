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

## 3. Out of scope at HEAD

Manual delete, dedicated Trash screen, permanent-delete action and automatic
purge on app open are in `plan/tasks.md`, not implemented at HEAD. A purge path,
when added, must be an explicit, documented exception to the "no background
deletion" rule and must be user-visible.

## 4. Failure behavior

A malformed `expiryDate` is ignored. Threshold values come from env / Remote
Config; the human-approval rule is code, not config.
