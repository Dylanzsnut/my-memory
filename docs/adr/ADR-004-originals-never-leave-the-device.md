# ADR-004: Originals never leave the device

- Status: Accepted · Date: 2026-11-17 · Related: RFC-001 §15, REQ-003
- Supersedes: none

## Context

Cloud features could become a backdoor for private photos, audio and notes.

## Decision

Cloud inference consumes derived summaries only. Firestore receives an explicit
metadata allowlist. Original blobs are stored in IndexedDB and never synced.

## Rejected alternatives

- Storing originals in Firestore for easier second-device access.
- Sending the original on cloud fallback.

## Consequences

A second device could list metadata but not open the evidence. The privacy
boundary is enforced by what the code sends, not by a README promise.

## Verification

`UNVERIFIED — no test yet`; enforcement point is `syncCaptureMetadata` in
`src/lib/firebase.ts`.
