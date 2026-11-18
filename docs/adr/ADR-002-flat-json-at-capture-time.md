# ADR-002: Flat JSON at capture time

- Status: Accepted · Date: 2026-11-17 · Related: RFC-001 §15, REQ-002
- Supersedes: none

## Context

Small on-device models are unreliable with deeply nested structured output.

## Decision

Ingestion returns a flat `summary`, `entities`, `expiryDate` schema. Invalid or
missing fields stay empty; the app does not guess.

## Rejected alternatives

- Nested extraction schemas repaired by a second pass.
- Free-form extraction parsed heuristically.

## Consequences

Retrieval, citation and forgetting all read the same flat fields. A failed
extraction degrades to embedding-only search on the derived text.

## Verification

`UNVERIFIED — no test yet`; contract is in `src/lib/ai.ts` and `src/types.ts`.
