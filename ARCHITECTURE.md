# My Memory — Architecture (index)

One sentence: a local-first Web/Chrome companion that captures photos, voice memos and notes, answers from one local index with citations, and never lets the model delete anything.

- Owner: Duy
- Last verified: 2026-11-18
- Against HEAD: `d7aa8d2`
- Split trigger: ~800 lines · AGENTS.md cap: 200 lines
- As-built: `docs/as-built/DATA.md`, `docs/as-built/DESIGN.md`, `docs/as-built/VERIFICATION.md`, `docs/as-built/specs/`

## 1. Goals & non-goals

| Goal | Non-goal |
|---|---|
| Capture three types with no naming or filing (`REQ-001`) | Cloud capture store |
| Answer only from cited local captures (`REQ-002`) | General assistant answers from model knowledge |
| Work offline after first load (`REQ-003`) | Multi-user sharing |
| Propose forgetting; human decides (`REQ-004`) | Auto-delete or bulk purge |
| Manual delete with recoverable trash (`REQ-005` owns the window) | Permanent deletion outside the trash flow |
| Mandatory Google sign-in (`REQ-006`) | Guest mode |

Owns only: the inference boundary, the local capture index, the evidence/citation gate, and the Forget proposal gate.

## 2. Context & topology

| Component | Interface | Responsibility | Implementation |
|---|---|---|---|
| CMP-001 Capture UI | browser file input, mic, textarea | Create captures, trigger extraction | `src/components/Memories.tsx` |
| CMP-002 Inference adapter | Firebase AI Logic `GenerativeModel` | `ONLY_ON_DEVICE` extraction, `PREFER_ON_DEVICE` short answer, `ONLY_IN_CLOUD` synthesis | `src/lib/ai.ts` |
| CMP-003 Evidence gate | `buildAnswer()` | Search, verify claims, fail closed | `src/lib/answer.ts`, `src/lib/search.ts` |
| CMP-004 Local store | IndexedDB via `idb` | Originals, records, proposals, HUD events | `src/lib/store.ts` |
| CMP-005 Forget engine | local cosine + expiry | Proposal only | `src/lib/forget.ts` |
| CMP-006 Firebase services | App Check, Firestore, Remote Config, AI | Privacy boundary, metadata sync opt-in | `src/lib/firebase.ts` |

Trust boundary: originals, transcripts and embeddings stay in CMP-004. Only derived fields listed in `docs/as-built/DATA.md` may cross to Firestore, and only when `VITE_ENABLE_FIRESTORE_SYNC=true`.

## 3. Runtime flows

- **FLOW-001 Capture:** UI → extraction (SDK) → local record + lexical embedding → IndexedDB. If extraction fails, keep the original and record an `error`; never send the original to cloud.
- **FLOW-002 Ask:** query → local search → top captures → answer (SDK or local fallback) → `parseClaims`/`verifyClaim` → cited answer or "Not found".
- **FLOW-003 Forget:** local scan → proposal → human approve/keep → trash with `trashedAt`/`purgeAt` → restore or purge.
- **FLOW-004 Sync (opt-in):** capture metadata → Firestore; originals never included.

## 4. Data contracts

Logical model: `ENT-001 Capture`, `ENT-002 ForgetProposal`, `ENT-003 HudEvent`, `ENT-004 Settings` in `docs/as-built/DATA.md`. Executable shapes: `src/types.ts`; schema: `src/lib/store.ts`, `firestore.rules`. No DDL is retyped here.

## 5. Budgets & guardrails

| Guardrail | Requirement | Enforcement | Fallback |
|---|---|---|---|
| GR-001 no citation, no answer | REQ-002 | `verifyClaim` in `src/lib/answer.ts` | return "Not found" |
| GR-002 originals never leave device | REQ-003 | `syncCaptureMetadata` field allowlist; `ONLY_ON_DEVICE` extraction | keep capture unextracted / SIMULATED |
| GR-003 proposals only | REQ-004 | `forget.ts` has no delete path | n/a |
| GR-004 protected captures excluded | REQ-004 | `protectedReason` filter in `scanForProposals` | no proposal |
| GR-005 recoverable trash | REQ-005 | `purgeAt` on trashed captures | restore before purge |

## 6. Security & concurrency

App Check is required for AI Logic. Dev uses the debug provider; production uses reCAPTCHA Enterprise. Firestore rules currently deny all; the per-user template is quoted, not active. IndexedDB is a single-writer store accessed through `src/lib/store.ts`. No background purge is implemented.

## 7. Failure modes

| Scenario | Behavior | Recovery |
|---|---|---|
| Nano unavailable | `SIMULATED` extraction/answer or cloud fallback with label | HUD shows source and error |
| Cloud unavailable | retry fallback model, then local fallback | HUD shows `SIMULATED` + error |
| No matching capture | "Not found in memory" | rephrase query |
| Firestore sync failure | caught and logged | local IndexedDB still works |

## 8. Deployment & config

Hosting config: `firebase.json`, rules: `firestore.rules`. Env vars: `.env.example`. Runbook: `docs/operations/WEB_SETUP.md`.

## 9. Traceability

See `docs/as-built/VERIFICATION.md`. There is no automated test suite yet; all requirement checks are `UNVERIFIED — no test yet` unless linked to a manual check.

## 10. Decision index

ADR-001 … ADR-009 in `docs/adr/`, extracted from `docs/rfc/001-my-memory-csd.md`.

## 11. Related docs

`README.md`, `AGENTS.md`, `docs/README.md`, `docs/requirements/`, `docs/as-built/`, `docs/operations/WEB_SETUP.md`, `docs/prototypes/`, `docs/standards/documentation-playbook-v3.1.md`.
