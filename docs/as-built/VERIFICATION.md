# Verification

- Owner: Duy · Last verified: 2026-11-20
- Check commands: `npm run typecheck`, `npm run lint`, `npm test` (`23` tests across `7` suites in `tests/core.test.ts`), `npm run build`
- Live device / Console caveats: Automated unit and corpus tests verify local search, fail-closed claim verification, offline synthesis refusal, sensitive-entity detection, F1/F2/F4 forgetting + trash purge, auto-tagging, JPEG EXIF parsing, and editable embedding groups (reconcile/split/rename/move/remove). Physical Chrome 139+ Nano 4 hardware behavior, mobile gallery import, and Firebase Console configuration remain manual external checks.

| Requirement | Component | Entity / Flow | Surface | Verified by |
|---|---|---|---|---|
| REQ-001 | CMP-001 | ENT-001 / FLOW-001 | UI-002 | Verified (unit/EXIF): `parseExifDateTimeOriginal` tested in `tests/core.test.ts`; camera/multi-select UI compiled cleanly (`npm run build`). Physical mobile Chrome gallery import needs manual device test. |
| REQ-001/003 | CMP-001, CMP-004 | ENT-005 / group flows | UI-002 | Verified (unit): `reconcileAutoGroups`, `splitGroup`, `renameGroup`, `moveCaptureToGroup`, and `removeGroup` pass in `tests/core.test.ts`; manual edits survive recompute, trashed captures stay ungrouped, and group deletion never removes captures. Physical UI check pending. |
| REQ-002 | CMP-003 | ENT-001 / FLOW-002 | UI-003 | Verified (unit/corpus): `search.ts` & `embeddings.ts` stopwords, EN/VI synonym retrieval, tag-only query retrieval, new-tag browse (local, cited), synonym-only hit, out-of-corpus refusal, AI error classification/timeouts, and a 50-capture local speed bound pass in `tests/core.test.ts`; shared tag scope + evidence tag chips compile (`npm run build`) but need a manual UI check. |
| REQ-003 | CMP-004 | ENT-001 / FLOW-002 | UI-002 | Verified (offline guard): `answer.ts` & `ai.ts` fail-closed `verifyClaim`, 5 in-corpus + 5 out-of-corpus Not-found checks, and offline long-synthesis connection guard pass in `tests/core.test.ts`. |
| REQ-004 | CMP-005 | ENT-002 / FLOW-003 | UI-004 | Verified (unit): F1 duplicate, F2 expired, F4 `protectedReason` exclusion (`scanForProposals`, `detectTextProtection`), and `applyDecision('keep')` pass in `tests/core.test.ts`. |
| REQ-005 | CMP-005 | ENT-001 / FLOW-003 | UI-004, UI-007 | Verified (unit): `moveToTrash` and `purgeExpiredTrash` (`purgeAt`) pass in `tests/core.test.ts`; Trash & DetailSheet delete/restore UI compiles (`npm run build`). |
| REQ-006 | CMP-007 | ownerUid partition | UI-001 | Verified (typecheck/lint/build): `SignInGate`, UID-partitioned IndexedDB (`store.ts`), and `/users/{uid}/captures/{captureId}` `firestore.rules` compile cleanly; Google provider Console sign-in & multi-user rule deployment need live Firebase project check. |
| REQ-007 | CMP-002, CMP-006 | FLOW-001, FLOW-002 | UI-006 | UNVERIFIED on live hardware — Nano 4 extraction/answer and App Check token exchange require Chrome 139+ with flags and provisioned Firebase Console project. |
| UI/UX review (2026-11-20) | CMP-001…007 | UI-002…007 | all screens | Verified (unit/build): 17 findings fixed; 2 new calendar-date-filter tests pass (`23/23`), typecheck/lint clean, production build succeeds. Contrast calculated and touch targets applied in code, but no automated axe or screen-reader run — see Process risks. |

## Input coverage

Automated corpus tests in `tests/core.test.ts` cover 5 EN/VI in-corpus questions, 5 out-of-corpus/trashed questions (`notFound: true`), whole-number and alphanumeric token verification, offline synthesis refusal, and sensitive-entity detection. The full 20-item manual field dataset in `docs/rfc/001-my-memory-csd.md` remains an external manual device evaluation.

## Process risks

- Human approval of forget decisions cannot be fully machine-verified; owner Duy
  reviews the Forget UI manually.
- The 2026-11-20 accessibility work (44px targets, 16px inputs, ≥11px labels,
  WCAG AA colour tokens, dialog focus handling) is verified by tests and code
  inspection only. An on-device visual pass at 375px, axe audit, and
  screen-reader walkthrough remain manual external checks.
- Live Firebase AI Logic behaviour depends on console provisioning outside the
  repo; no evidence of that state is committed here.

## Crystallization parity

`docs/rfc/001-my-memory-csd.md` was frozen with an extraction map at the top of
the file. Parity result: partial — requirements, topology and decisions were
extracted; the 20-item test set in the CSD remains in the historical RFC and has
not been converted into executable tests. This is recorded as UNVERIFIED, not
as a pass.
