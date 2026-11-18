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
- `intent === 'long'` selects `ONLY_IN_CLOUD` with the configured model; the
  primary model is retried once with the documented fallback model.
- `intent === 'short'` selects `PREFER_ON_DEVICE`; `inferenceSource` is read from
  the SDK response and mapped to `ON_DEVICE | IN_CLOUD | SIMULATED`.

## 3. State & degradation

No Nano → simulated extraction; cloud failure with configured model → fallback
model → simulated answer. Every fallback is labelled; none is presented as a
successful model run.

## 4. Edge cases

- Unknown SDK source value → `SIMULATED`.
- Invalid extraction JSON → capture kept with `error`.
- No citations in generated answer → "Not found" via `src/lib/answer.ts`.
