# ADR-001: One index for three capture types

- Status: Accepted · Date: 2026-11-17 · Related: RFC-001 §15, REQ-001
- Supersedes: none

## Context

Photo, voice and note search lived in separate tools, recreating the
fragmentation the product exists to remove.

## Decision

Photos, voice transcripts and notes share one local index. In the pinned design
this is one EmbeddingGemma 2 space; at HEAD the Web build uses a local lexical
embedder, recorded as an explicit deviation in `ADR-009`.

## Rejected alternatives

- Per-type indexes and separate searches.
- Cloud-side cross-type retrieval.

## Consequences

A text question can return a photo or voice memo. Storage growth is accepted.

## Verification

`UNVERIFIED — no test yet`; the invariant is recorded in `docs/as-built/DATA.md`.
