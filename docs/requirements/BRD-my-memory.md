# BRD: My Memory Web companion

- Owner: Duy · Last verified: 2026-11-18 · Against HEAD: `d7aa8d2`
- Status: Accepted
- Stakeholder: Duy (builder and first user)

## 1. Problem

People capture receipts, plates, medicine boxes and voice notes, then cannot find
them again. Existing tools separate capture types, require naming at capture
time, or return answers without evidence.

## 2. Outcomes (measurable)

- OUT-1: A user captures a photo, voice memo or note without naming or filing it.
- OUT-2: A question returns an answer with the original capture attached, or an
  explicit "Not found".
- OUT-3: The index and search work with the network off after first load.
- OUT-4: Forgetting is a proposal with evidence; only a human decision changes
  retention.

## 3. Scope & non-goals

In scope: the Web/Chrome companion, mandatory Google sign-in, manual memory
deletion with recoverable trash, metadata-only sync.

Out: Android build, multi-user sharing, cloud capture store, auto-delete,
general assistant answers from model knowledge.

## 4. Imposed constraints

- CON-1: Firebase AI Logic is the required inference layer; hybrid calls must be
  made at runtime. Source: competition brief quoted in `rfc/001-my-memory-csd.md`.
- CON-2: Original blobs, transcripts and embeddings never leave the device.
  Source: product boundary in `rfc/000-my-memory-concept.md`.
- CON-3: App Check enforcement is required for Firebase AI Logic. Source:
  Firebase AI Logic documentation (checked 2026-11-18).
- CON-4: UI and repo docs are English-first; Vietnamese is an optional toggle.
  Source: product decision recorded in `rfc/001-my-memory-csd.md`.

## 5. Success criteria

Each outcome maps to a `REQ` in `req-web-app.md`. A `REQ` without a linked test
or run log is `UNVERIFIED`, not assumed met.
