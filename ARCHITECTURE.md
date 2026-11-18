# My Memory — Architecture (index)

One sentence: a local-first Web/Chrome companion that captures photos, voice memos and notes, answers from one local index with citations, and never lets the model delete anything.

- Owner: Duy
- Last verified: 2026-11-18
- Against HEAD: `d7aa8d2`
- Split trigger: ~800 lines · AGENTS.md cap: 200 lines
- Extracted from: `docs/rfc/001-my-memory-csd.md` (frozen, historical — not a build source)
- Authority: `README.md`, `AGENTS.md`, `docs/requirements/`, `docs/as-built/`, `contracts/`
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
| Call Firebase AI Logic at runtime with explicit modes (`REQ-007`) | Naming the SDK without calling it |

The product differentiator is the combination, not any single feature: one
index across capture types, grounded answers, and human-approved forgetting.

Owns only: the inference boundary, the local capture index, the evidence/citation
gate, and the Forget proposal gate. The Firebase AI Logic layer is intelligence;
the local store is memory; deterministic rules are the authority layer. The
model never writes a record without schema validation, never answers without a
citation, and never deletes anything.

## 2. Context & topology

The design boundary spans a device and a cloud side. The Web build in this
repository is the Chrome companion; the Android primary path described in the
CSD is not in this repository.

| Side | Component | Interface | Responsibility | Implementation |
|---|---|---|---|---|
| Device | CMP-001 Capture UI | file input, mic, textarea | Create captures, trigger extraction | `src/components/Memories.tsx` |
| Device | CMP-002 Inference adapter | Firebase AI Logic `GenerativeModel` | On-device extraction, hybrid short answer, cloud synthesis | `src/lib/ai.ts` |
| Device | CMP-003 Evidence gate | `buildAnswer()` | Search, verify claims, fail closed | `src/lib/answer.ts`, `src/lib/search.ts` |
| Device | CMP-004 Local store | IndexedDB via `idb` | Originals, records, proposals, HUD events | `src/lib/store.ts` |
| Device | CMP-005 Forget engine | local cosine + expiry | Proposal only | `src/lib/forget.ts` |
| Cloud | CMP-006 Firebase services | App Check, Firestore, Remote Config, AI | Privacy boundary, opt-in metadata sync, config | `src/lib/firebase.ts` |

Cloud services are reached only when needed: long synthesis, metadata sync when
explicitly enabled, and the inference request envelope. Remote Config may tune
thresholds and model names; it cannot change a product law.

## 3. Trust boundary

The standing rule: **the model proposes, deterministic logic and the human
dispose.** The model proposes summaries, entities, rankings, answers and forget
candidates; it decides none of them. Deterministic rules decide whether an
answer may be shown, whether a capture may enter the Forget Queue, and what may
never be proposed. The human decides deletion. The system is fail-closed.

| What | Leaves the device? | Where / when |
|---|---|---|
| Original photo, audio or note text | No | Stays in CMP-004 as read-only evidence |
| ASR transcript / derived OCR text | No | Local derived index only |
| Embedding vector | No | Local index only |
| Metadata allowlist (`summary`, `entities`, `expiryDate`, timestamps) | Yes, metadata only | Firestore, only if sync is enabled (`REQ-003`, ADR-004) |
| JSON summaries of selected captures | Yes, light payload only | Cloud model, long synthesis only (`REQ-007`) |
| Inference request/response envelope | Yes | Firebase AI Logic, App Check enforced |

The privacy boundary is data, not latency: the cloud answer must return claims
the device can re-attach to local captures. It is never given the originals it
would need to replace them. See `docs/as-built/DATA.md` for the exact field
allowlist and `contracts/README.md` for executable schemas.

## 4. Inference contracts and mode choice

The SDK exposes four modes; the mode is chosen per call site, not globally.

| Mode | Semantics |
|---|---|
| `PREFER_ON_DEVICE` | Use on-device model if available and supported; otherwise fall back to cloud |
| `ONLY_ON_DEVICE` | Use on-device model if available and supported; otherwise throw |
| `PREFER_IN_CLOUD` | Prefer cloud; fall back to on-device when offline; other failures throw |
| `ONLY_IN_CLOUD` | Use cloud only; otherwise throw |

| Call site | Payload | Mode | Reason |
|---|---|---|---|
| Ingest extraction | original image or transcript | `ONLY_ON_DEVICE` | A cloud fallback would forward a private original (ADR-009) |
| Voice transcript extraction | transcript text | `ONLY_ON_DEVICE` | Derived from a private original |
| Short cited answer | query + summaries/entities | `PREFER_ON_DEVICE` | Text-only payload; fallback is labelled through `inferenceSource` |
| Long synthesis | JSON summaries of selected captures | `ONLY_IN_CLOUD` | Explicit escalation; failure means the app says a connection is needed |
| Availability probe | none | feature / category check | Decides which call sites are reachable; drives graceful degradation |

Provenance is explicit: a response label comes from the SDK or is `SIMULATED`;
it is never guessed. An unknown or missing SDK source becomes `SIMULATED` (ADR-008).

Design pins from the CSD are recorded as design intent, not current as-built
facts: Gemini Nano 4 for on-device inference, Gemini Flash-class model for
synthesis with its documented fallback, and EmbeddingGemma 2 as the production
embedder. Model names are overridable through Remote Config because they churn.
Current Web deviations are listed in *Known limits* below and in ADR-009.

## 5. Runtime flows

- **FLOW-001 Capture:** UI → `ONLY_ON_DEVICE` extraction → local record + local embedding → IndexedDB. Failure keeps the original and records an error; no cloud retry for an original.
- **FLOW-002 Voice capture:** record audio locally → transcript if available → text extraction path → audio kept as the original evidence.
- **FLOW-003 Ask, local:** query → local search across all capture types → top captures → short answer → `parseClaims`/`verifyClaim` → cited answer or refusal. Works offline.
- **FLOW-004 Cross-language ask:** normalized keywords and bilingual synonyms sit over one local embedding space; question language and capture language need not match (ADR-007).
- **FLOW-005 Long synthesis:** selected captures only → JSON summaries to cloud → citations resolved back to local captures before display. Offline means "needs a connection", not a faked local synthesis.
- **FLOW-006 Forget:** local scan → evidence-linked proposal → human approve/keep → trash with `trashedAt`/`purgeAt` → restore or purge. Proposal only (ADR-005).
- **FLOW-007 Degraded model:** Nano unavailable → visible banner, originals and local search kept, labelled fallback. No silent substitution.
- **FLOW-008 Metadata sync (opt-in):** metadata allowlist → Firestore; originals, transcripts and embeddings never included (ADR-004).

Flow truth for the shipped Web build is in `docs/as-built/DESIGN.md` and the
deep specs; these flows are the architecture-level contract extracted from the CSD.

## 6. Data contracts

Logical entities are `ENT-001 Capture`, `ENT-002 ForgetProposal`,
`ENT-003 HudEvent` and `ENT-004 Settings`; see `docs/as-built/DATA.md`.
Executable shapes are `src/types.ts`; storage schema is `src/lib/store.ts`;
Firestore shape is the field allowlist in `syncCaptureMetadata` plus
`firestore.rules`. No DDL is retyped here.

The capture record is the citation target. Derived summary, entities, embedding
and source match are indexes; the original is read-only and never replaced.
`expiryDate` is extracted from the capture itself or null; it is never inferred.

## 7. Rules and guardrails

Grounded answer rules:

- **G1 — No citation, no answer.** Every answer needs at least one capture id that resolves locally; otherwise the answer is dropped.
- **G2 — Numbers come from captures.** Amounts, dates, plates and names are copied from the cited record or original, never invented.
- **G3 — Not found is valid.** Below-threshold retrieval returns "Not found" in every mode; the threshold is never silently lowered.

Forget rules:

- **F1 — Duplicate.** A later capture may be proposed against an earlier one of the same type with measurable similarity evidence; the earlier capture is never proposed.
- **F2 — Expired.** Only a capture's own stated expiry can justify an expiry proposal.
- **F3 — Superseded** is reserved in the data model and not scored by v1.
- **F4 — Hard protections.** Protected captures are excluded from proposals regardless of score.
- **F5 — Proposal only.** Every transition to trash requires a recorded human decision and remains recoverable for the window owned by `REQ-005`.

| Guardrail | Requirement | Enforcement | Fallback |
|---|---|---|---|
| GR-001 no citation, no answer | REQ-002 | `verifyClaim` in `src/lib/answer.ts` | return "Not found" |
| GR-002 originals never leave device | REQ-003 | field allowlist; `ONLY_ON_DEVICE` extraction | keep unextracted / `SIMULATED` |
| GR-003 proposals only | REQ-004 | `forget.ts` has no delete path | n/a |
| GR-004 protected captures excluded | REQ-004 | `protectedReason` filter | no proposal |
| GR-005 recoverable trash | REQ-005 | `purgeAt` on trashed captures | restore before purge |
| GR-006 runtime hybrid inference | REQ-007 | per-call-site modes; SDK provenance | explicit labelled fallback |

Thresholds and model names are configuration. The approval rule, protections
and citation requirement are code and are not configurable.

## 8. Failure modes

| Failure mode | Guardrail / response |
|---|---|
| Fabrication | G1, G2, `citation_verifier` path in `src/lib/answer.ts` |
| Evidence loss | original blob is read-only beside the index; derived data is an index only |
| Silent auto-deletion | F4, F5, no auto-delete path |
| Network dependence | local index and local search first; cloud only for explicit synthesis |
| False forget proposals | F1/F2 require measurable evidence; F4 protections; "keep" is feedback |
| Model unavailable | labelled fallback per FLOW-007; never a silent substitution |
| Cloud synthesis failure | retry documented fallback model, then labelled local fallback |

## 9. Security, concurrency and privacy

App Check is required for Firebase AI Logic. Development uses the debug
provider; production uses reCAPTCHA Enterprise. Firestore rules currently deny
all; the per-user template is quoted, not active. IndexedDB is a single-writer
store accessed through `src/lib/store.ts`. No background purge exists at HEAD.

## 10. Deployment & config

Hosting config: `firebase.json`; rules: `firestore.rules`; env template:
`.env.example`; runtime defaults: `src/lib/config.ts`. Runbook:
`docs/operations/WEB_SETUP.md`.

## 11. Traceability

See `docs/as-built/VERIFICATION.md`. There is no automated test suite yet;
requirement checks are `UNVERIFIED` unless linked to a recorded run. The CSD
test set remains in the frozen RFC and has not been converted into tests.

## 12. Decision index

ADR-001 One index for three capture types · ADR-002 Flat JSON at capture time ·
ADR-003 Voice bypasses Nano for audio · ADR-004 Originals never leave the
device · ADR-005 Forgetting is proposal-only · ADR-006 Fail-closed answers ·
ADR-007 Cross-language retrieval at index level · ADR-008 HUD is evidence ·
ADR-009 Ingest runs `ONLY_ON_DEVICE`.

## 13. Known limits (2026-11-18, owner Duy)

- The shipped Web build uses a local lexical embedder, not EmbeddingGemma 2; this is an explicit deviation, not a silent substitution (ADR-009).
- Nano 4 availability and the live hybrid smoke test are not verified in this repository.
- Mandatory Google sign-in and manual deletion are planned, not implemented at HEAD; see `docs/plan/tasks.md`.
- No automated tests, no persisted verification run log.
- The CSD's numeric targets are historical design targets, not measured results.

## 14. Related docs

`README.md`, `AGENTS.md`, `docs/README.md`, `docs/requirements/`,
`docs/as-built/`, `docs/operations/WEB_SETUP.md`, `docs/prototypes/`,
`docs/standards/documentation-playbook-v3.1.md`, `docs/rfc/001-my-memory-csd.md`.
