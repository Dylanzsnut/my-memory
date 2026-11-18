# ADR-006: Fail-closed answers

- Status: Accepted · Date: 2026-11-17 · Related: RFC-001 §15, REQ-002
- Supersedes: none

## Context

A plausible wrong expiry date is a safety problem, not a UX nuisance.

## Decision

No citation means no answer. Below-threshold retrieval returns "Not found". A
model failure returns a labelled local fallback, never a confident answer.

## Rejected alternatives

- Softening an unverified claim with a warning.
- Falling back to general knowledge in the voice of the user's memory.

## Consequences

Some questions return less than the user hoped for. That is the product promise.

## Verification

`UNVERIFIED — no test yet`; enforcement point is `src/lib/answer.ts`.
