# ADR-003: Voice bypasses Nano for audio

- Status: Accepted · Date: 2026-11-17 · Related: RFC-001 §15
- Supersedes: none

## Context

Firebase AI Logic on-device accepts text and text-plus-image, not audio.

## Decision

Voice capture records audio locally. A transcript is produced separately where
available and only that text is passed to Nano. Audio is embedded through its
derived text in the Web build and remains as the original evidence.

## Rejected alternatives

- Sending audio to the cloud model.
- Pretending Nano accepts audio input.

## Consequences

Extraction quality depends on transcript availability; retrieval quality does
not depend on the model.

## Verification

`UNVERIFIED — no automated audio flow test`; behavior is in
`src/components/Memories.tsx` and `src/lib/ai.ts`.
