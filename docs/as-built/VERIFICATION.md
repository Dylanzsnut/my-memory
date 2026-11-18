# Verification

- Owner: Duy · Last verified: 2026-11-18 · Against HEAD: `d7aa8d2`
- Build commands: `npm run typecheck && npm run build` (passed 2026-11-17)
- Run log: not persisted in repo; command output was captured in the work session.

| Requirement | Component | Entity / Flow | Surface | Verified by |
|---|---|---|---|---|
| REQ-001 | CMP-001 | ENT-001 / FLOW-001 | UI-002 | UNVERIFIED — no test yet |
| REQ-002 | CMP-003 | ENT-001 / FLOW-002 | UI-003 | UNVERIFIED — no test yet |
| REQ-003 | CMP-004 | ENT-001 / FLOW-002 | UI-002 | UNVERIFIED — no offline run log |
| REQ-004 | CMP-005 | ENT-002 / FLOW-003 | UI-004 | UNVERIFIED — no test yet |
| REQ-005 | planned | ENT-001 | planned | UNVERIFIED — not implemented at HEAD |
| REQ-006 | planned | new uid key | planned | UNVERIFIED — not implemented at HEAD |
| REQ-007 | CMP-002, CMP-006 | FLOW-001, FLOW-002 | UI-006 | UNVERIFIED — no live smoke-test log |

## Input coverage

No `IN-xxx` evidence items are registered. Requirements derive from `README.md`,
`plan/tasks.md` and the historical RFCs via the BRD.

## Process risks

- Human approval of forget decisions cannot be fully machine-verified; owner Duy
  reviews the Forget UI manually.
- Live Firebase AI Logic behaviour depends on console provisioning outside the
  repo; no evidence of that state is committed here.

## Crystallization parity

`docs/rfc/001-my-memory-csd.md` was frozen with an extraction map at the top of
the file. Parity result: partial — requirements, topology and decisions were
extracted; the 20-item test set in the CSD remains in the historical RFC and has
not been converted into executable tests. This is recorded as UNVERIFIED, not
as a pass.
