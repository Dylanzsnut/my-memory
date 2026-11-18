# ADR-007: Cross-language retrieval at the index level

- Status: Accepted · Date: 2026-11-17 · Related: RFC-001 §15
- Supersedes: none

## Context

Real captures are Vietnamese; judge questions are English. On-device generation
does not cover every capture language.

## Decision

Retrieval uses normalized bilingual keywords and synonyms over one embedding
space. Generation language is separate and may use templates or cloud
escalation.

## Rejected alternatives

- Translating the whole index at query time.
- Requiring the question to match the capture language.

## Consequences

A Vietnamese capture can be found by an English question while the answer label
still reports how it was produced.

## Verification

`UNVERIFIED — no test yet`; synonym layer is in `src/lib/embeddings.ts`.
