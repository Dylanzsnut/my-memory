# Verification

- Owner: Duy · Last verified: 2026-11-21
- Check commands: `npm run typecheck`, `npm run lint`, `npm test` (`26` tests across `8` suites in `tests/core.test.ts`), `npm run build`
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
| UI/UX review (2026-11-20) | CMP-001…007 | UI-002…007 | all screens | Verified (unit/build): 17 findings fixed; 2 new calendar-date-filter tests pass, typecheck/lint clean, production build succeeds. Contrast calculated and touch targets applied in code, but no automated axe or screen-reader run — see Process risks. |
| Entity approval & tag filters (2026-11-20) | CMP-001, CMP-004 | ENT-001 | UI-002, UI-003, UI-005 | Verified (unit): `prepareEntityTag` (add/tagged/sensitive/unusable) and `sortTagOptions` (count, tie-break, pinned selection) pass in `tests/core.test.ts`; UI compiles and builds. Manual device pass for wrapped/expanded tag chips and 375px layout still pending. |
| Responsive web layout (2026-11-21) | CMP-001…007 | UI-001…007 | all screens | Verified (build/static): typecheck, lint, tests and production build pass; generated CSS contains the `md:` drawer utility and safe-area rules. UNVERIFIED visually: no browser was available for the 375/768/1024/1280px pass, so no horizontal-scroll, focus-order or no-overlap claim is made. |
| Desktop workspace (2026-11-21) | CMP-001…007 | UI-001…007 | all screens | Verified (unit/build): `formatBytes`, `countByType`, `groupByDay`, `navTarget` and redacted `buildCopyText` pass in `tests/core.test.ts`; typecheck/lint/build pass. UNVERIFIED visually: no browser for the 375/768/1024/1280/1440px workspace, keyboard and focus pass. Recent questions stay in local user meta and are removed with account deletion. |
| Plain-language UI (2026-11-21) | CMP-001…007 | UI-001…007 | all screens | Verified (code/build): all technical labels moved behind the `technicalDetails` setting (off by default); provenance and Not-found stay explicit; demo greeting no longer uses "Demo" as a name. Typecheck/lint/29 tests/build pass. UNVERIFIED visually: no browser run for the toggle across 375–1440px. |
| Desktop workspace v2 (2026-11-21) | CMP-001…007 | UI-002…007 | desktop | Verified (unit/build): new date ranges, pagination and tag collections pass in `tests/core.test.ts`; typecheck/lint/build pass. UNVERIFIED visually: no browser for the full-width grid, Overview, compact filter bar or paging interaction. |
| Preview/tag-lock/Ask suggestions (2026-11-21) | CMP-001…007 | UI-002, UI-003, UI-005 | desktop + mobile | Verified (unit/build): `pickInspected`, narrow tag-secret detection and `suggestQuestions` (empty library, expiry, secrets excluded, online tag totals, VI, no fixed phrases) pass — 33/33 tests; answer check and cloud redaction unchanged. UNVERIFIED visually: no browser for the panel in Overview or the suggestion chips. |
| Expiry correctness (2026-11-21) | CMP-003 | ENT-001 | UI-003, UI-005 | Verified (unit): `validExpiry`/`captureExpiry` reject "null"/invalid dates; `verifyClaim` rejects "In null"; expiry question with no valid date returns Not found; valid dates answer with a numeric form that verifies. 34/34 tests pass. Storage repair of legacy `"null"` values runs on app open (code-verified, not device-verified). |

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
