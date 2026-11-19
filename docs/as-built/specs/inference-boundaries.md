# Spec: inference boundaries

- Owning module: `src/lib/ai.ts` · Depth: DEEP
- Related: ADR-004, ADR-009, REQ-002, REQ-007
- Owner: Duy · Last verified: 2026-11-18 · Against HEAD: `d7aa8d2`

## 1. Invariants

| ID | Must always hold | Verified by |
|---|---|---|
| INV-101 | Image or transcript extraction uses `ONLY_ON_DEVICE` | UNVERIFIED — no test yet |
| INV-102 | A failed extraction keeps the original and never sends it to cloud | UNVERIFIED — no test yet |
| INV-103 | Long synthesis uses `ONLY_IN_CLOUD` and receives summaries only | UNVERIFIED — no test yet |
| INV-104 | A missing SDK provenance value becomes `SIMULATED`, never `ON_DEVICE` | UNVERIFIED — no test yet |

## 2. Contract

- `extractCapture(req)` returns `{extraction, source, latencyMs, error?}`.
- `answerQuestion(question, captures, intent)` returns text, source, latency,
  intent, and optional `error`.
- `intent === 'long'` selects `ONLY_IN_CLOUD` with the configured model, a 12 s
  timeout, and a single retry on the documented fallback model **only for
  transient errors** (`isTransientAiError`); 403 / App Check / quota / network
  errors degrade straight to the labelled local fallback. The cloud context
  holds summaries and entities only — never `tags`.
- `intent === 'short'` **never uses the cloud.** Tag-browse questions
  (`tagBrowseTarget`) are answered by a deterministic local lookup with no model
  call. Other short questions use local retrieval, then `ONLY_ON_DEVICE` (8 s
  timeout) only when Nano is `readily`; otherwise the deterministic local answer.
  On-device context includes `tags`. Local answers are `SIMULATED` (badge text
  "Local lookup"); a model-written answer carries the SDK `inferenceSource`.

## 3. State & degradation

No Nano → simulated extraction and local short answers; long cloud failure →
(transient only) fallback model → simulated answer. Every fallback is labelled; none is presented as a
successful model run.

## 4. Edge cases

- Unknown SDK source value → `SIMULATED`.
- Invalid extraction JSON → capture kept with `error`.
- No citations in generated answer → "Not found" via `src/lib/answer.ts`.
