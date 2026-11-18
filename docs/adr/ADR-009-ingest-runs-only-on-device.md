# ADR-009: Ingest runs ONLY_ON_DEVICE

- Status: Accepted · Date: 2026-11-17 · Related: RFC-001 §15, REQ-007
- Supersedes: none

## Context

`PREFER_ON_DEVICE` falls back to cloud automatically and would forward an
original image or transcript off the device.

## Decision

Extraction uses `ONLY_ON_DEVICE`. On failure the capture is kept with a minimal
local derivation and an error; no model substitution or cloud fallback for the
original. The Web build's lexical embedder is an explicit, labelled deviation
from the design's EmbeddingGemma 2 pin, not a silent replacement.

## Rejected alternatives

- `PREFER_ON_DEVICE` for image extraction.
- Retrying extraction in cloud when Nano is unavailable.

## Consequences

A device without Nano cannot extract fields at capture time; the original and
local search remain available.

## Verification

`UNVERIFIED — no live smoke-test log`; enforcement point is `extractCapture` in
`src/lib/ai.ts`.
