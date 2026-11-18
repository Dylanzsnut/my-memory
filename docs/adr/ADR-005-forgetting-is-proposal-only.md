# ADR-005: Forgetting is proposal-only, with a trash

- Status: Accepted · Date: 2026-11-17 · Related: RFC-001 §15, REQ-004, REQ-005
- Supersedes: none

## Context

A wrong deletion is permanent; a wrong keep costs only clutter.

## Decision

The Forget engine proposes candidates with evidence. Only a recorded human
decision moves a capture to a recoverable trash. Permanent deletion is a later,
explicit action.

## Rejected alternatives

- Auto-clean mode.
- Immediate deletion after approval.
- Bulk purge.

## Consequences

Storage growth is accepted. The UI must make `Keep` a first-class outcome. A
future purge path must be documented as a user-visible exception, not a silent
background job.

## Verification

`UNVERIFIED — no test yet`; enforcement point is `src/lib/forget.ts`.
