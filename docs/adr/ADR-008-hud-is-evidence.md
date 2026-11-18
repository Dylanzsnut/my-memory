# ADR-008: The HUD is evidence, not decoration

- Status: Accepted · Date: 2026-11-17 · Related: RFC-001 §15, REQ-007
- Supersedes: none

## Context

A hybrid claim is only credible if the local/cloud decision is observable.

## Decision

Every AI call records `InferenceSource`, latency and a short detail in the HUD.
The label comes from the SDK response or is `SIMULATED`; it is never guessed.

## Rejected alternatives

- Showing a static "local-first" badge.
- Hiding cloud fallback from the UI.

## Consequences

The demo can show local/cloud decisions live. The HUD is part of the contract,
not telemetry decoration.

## Verification

`UNVERIFIED — no test yet`; UI is `src/components/Hud.tsx`.
