# Documentation Playbook — Docs-as-Code

- **Owner:** Duy
- **Last verified:** 2026-11-18
- **Against HEAD:** `<playbook commit sha — fill on commit; UNVERIFIED until then>`
- **Version:** v3 (2026-11-18)
- **Supersedes:** v2 (2026-11-18)
- **Status:** living guide. It describes how docs are written here; it is not a
  template to copy blindly into a repo. Adapt the triggers and the file names to
  the repo, keep the rules.

The standard this playbook is judged by is the one applied to the code it
documents: **flaws first, evidence cited, fail closed.** A doc that asserts
something unverified is worse than a doc that says "unverified". This playbook
is a permanent doc, so it carries the header above like every other one.

---

## 0. How to read this

**Reading order is layer order, not accretion order.** Evidence, then
requirements, then logical, component, data, design, technical — then the
workflow that moves content between them. A playbook that preaches layering
must not be ordered by the date each section was bolted on.

Two rules make this both flexible and complete:

1. **Complete = coverage, not volume.** Every layer answered, every invariant
   has an enforcement point or an honest `UNVERIFIED`, every requirement maps to
   a test. Not "every template section filled with prose".
2. **Flexible = layers are mandatory, files are not.** A layer earns its own
   file when a split trigger fires. Until then, layers may share a file.
   Splitting early buys folders, not clarity.

Cross-references use **names and IDs, never section numbers**. Section numbers
drift; IDs do not.

**A note on this file's own length.** This playbook is about 1,400 lines,
which exceeds its own ~800-line split trigger. That is the documented
exception, not a hidden contradiction: the playbook is a single reference
that is read by layer, not top-to-bottom, and splitting it into a dozen
files would make it harder to adopt as one guide. A repo's God Doc does
not get the same exception — a God Doc is read as one design, and the
split trigger applies to it in full.

---

## 1. Principles

### 1.1 Separate by rate of change

Never mix a stable architectural principle with a volatile implementation
detail in the same file. A reader who wants the boundary should not have to
wade through last week's refactor.

| Layer | What it holds | Changes when |
|---|---|---|
| `docs/inputs/` | Raw customer evidence: RFP, RFI, transcript, email (`IN-xxx`) | **Never — append-only, immutable** |
| `docs/requirements/` | BRD (`OUT-x`, `CON-x`) + numbered requirements (`REQ-xxx`) | A business goal or constraint changes |
| `README.md` | Problem, quickstart, doc map | The pitch or the first 5 minutes change |
| `ARCHITECTURE.md` | Topology, boundaries, contracts, budgets, failure modes; index into `docs/as-built/` | A boundary or a core contract shifts |
| `docs/rfc/` or CSD | One-file design, end-to-end, before/during build ("God Doc") | **Frozen once implemented; quarantined from agents** |
| `docs/adr/` | One decision + what was rejected ("Discard List") | Append-only; supersede, never overwrite |
| `docs/as-built/DATA.md` | As-built data: logical ERD (`ENT-xxx`), physical schema and key-prefix catalog, query-to-index map (`IDX-xxx`), lineage | A table, key layout, index, or retention rule changes |
| `docs/as-built/DESIGN.md` | As-built UI and UX: surfaces (`UI-xxx`), interaction state matrix, design tokens, copy and i18n single source, accessibility | A screen, user flow, visual token, or copy rule changes |
| `docs/as-built/specs/` | Deep as-built specs: invariants (`INV-xxx`), wire and binary layout, algorithms, state machines, guardrails | A subsystem version changes |
| `docs/as-built/VERIFICATION.md` | Traceability matrix, latest verified test run pointers, input coverage, process risks, crystallization parity | A test run, a requirement, or a parity result changes |
| Code docs | Package `README.md` files + public docstrings (concurrency, preconditions, error contracts) | In the same commit as the code they document |
| `AGENTS.md` | Build/test commands, conventions, hard boundaries. **≤ 200 lines** (starting value) | A command or a boundary changes |
| `docs/operations/` | Runbooks, deployment topology, observability, **demo runbook, pitch, submission checklist** | Operations change |
| `contracts/` or migrations | Schema, DDL, API schema — the executable source of truth | A contract changes |

### 1.2 One source of truth per fact (SSOT)

A number, a version, or a claim lives in exactly one place and is referenced
everywhere else. The moment the same figure appears in two files, one of them
is already stale.

- **Test counts, pass rates, case counts:** cite the run log (path + date +
  HEAD), never a bare number. "699 passing" without a log is a claim, not a fact.
- **Upstream versions:** cite the pin (`go.mod`, lockfile) and the date checked.
  "Latest is v0.2.2" rots the day v0.2.3 ships.
- **Dates on every dated claim.** A claim without a date cannot be judged stale.
- **Non-functional requirement numbers belong to the requirement.** The
  `REQ-xxx` owns the target number. `ARCHITECTURE.md` and
  `docs/as-built/specs/` own the *enforcement mechanism* and the *fallback*,
  and cite the `REQ-xxx` instead of restating the number. A latency target
  written in three files is three chances to be wrong.

### 1.3 Every claim is traceable or marked unverified

Three states, no fourth:

- **Verified** — points at code, a test, or a run log (file + line, or log path
  + HEAD + date).
- **Claimed** — written in a commit message or a chat, not yet checked. Label it
  `CLAIMED`, never present it as verified.
- **Unverified** — written as a hypothesis or a TODO. Label it, or delete it.

An architectural invariant must name the test or script that verifies it. If no
such test exists, it is marked `UNVERIFIED — no test yet`, and that is honest.

An invariant that **cannot** be checked by code is marked
`PROCESS-RISK — <why not machine-checkable>`, with an owner. Do not invent a
metric to make it look verified.

### 1.4 Docs fail closed

The same rule as the systems documented here (model proposes, deterministic
rules dispose; a learned workflow is a proposal until approved). Applied to docs:

- A doc that cannot verify a claim says so. It does not soften the claim into
  something that sounds verified.
- A frozen doc (RFC marked `Implemented`, an ADR body, any input) is never
  silently edited. A correction is a new ADR, a new input, or an explicit
  amendment note with a date.
  **Exception:** an ADR's `Status` field may change (`Accepted → Superseded by
  ADR-XXX`) without an amendment note. The body may not.
- A doc that contradicts the code is wrong, not "outdated". Fix the doc or fix
  the code, and say which one changed.

### 1.5 Precedence — two axes, not one chain

Requirements sit above design, but they do not outrank it on everything.
Conflicts are resolved on the axis they belong to:

```
Intent axis    (what / why / acceptance):
  docs/requirements/req-*  >  ARCHITECTURE + specs  >  ADR  >  RFC

Technical axis (how / mechanism / contract):
  contracts + ARCHITECTURE + specs  >  ADR  >  RFC
```

- **Requirements never dictate mechanism.** `REQ-014` may demand a latency
  target; it may not choose the timeout implementation.
- A **cross-axis conflict** — a requirement the current design cannot meet — is
  not auto-resolved. Stop, record it as an open question, ask the owner. Never
  weaken a requirement silently, never change a spec silently.
- `docs/inputs/` is evidence, not authority: a customer statement never
  outranks a signed-off requirement.
- `docs/rfc/` is **history**. It is never a build source once crystallized.

### 1.6 Stable IDs, not section numbers

Cross-references use IDs. Section numbers are not identities: a `15.2` sitting
inside section `13` is what happens when references point at numbers.

| ID | Meaning | Lives in |
|---|---|---|
| `IN-xxx` | Raw customer evidence item | `docs/inputs/` |
| `OUT-x`, `CON-x` | BRD outcome, imposed constraint | `docs/requirements/brd-*.md` |
| `REQ-xxx` | Requirement with acceptance | `docs/requirements/req-*.md` |
| `INV-xxx` | Invariant that must always hold | `ARCHITECTURE.md`, `docs/as-built/specs/` |
| `GR-xxx` | Guardrail (enforcement + fallback) | `ARCHITECTURE.md`, `docs/as-built/specs/` |
| `CMP-xxx` | Component | `ARCHITECTURE.md`, component cards |
| `ENT-xxx` | Domain entity | logical / data design |
| `FLOW-xxx` | Runtime flow | `ARCHITECTURE.md` |
| `IDX-xxx` | Database index or key-value prefix scan path | `docs/as-built/DATA.md` |
| `UI-xxx` | User-facing surface, screen, or interactive component | `docs/as-built/DESIGN.md` |
| `RFC-NNN`, `ADR-NNN` | Proposal, decision | `docs/rfc/`, `docs/adr/` |
| verification | `test file :: test name` (not an abstract ID) | traceability matrix |

**Traceability chain:**
`IN → OUT/CON → REQ → ADR → CMP → ENT/FLOW → test`

A data index or a UI surface joins the chain where it is used:
`REQ → IDX-xxx → test` for a storage requirement, and
`REQ → UI-xxx → test` for a user-facing requirement. An `IDX-xxx` with no
query and a `UI-xxx` with no state matrix are both undocumented design.

Two gaps, both detectable, both failures:
- an `IN` marked must-respond with no `REQ` = **unaddressed customer input**;
- a `must` `REQ` with no test and no explicit `UNVERIFIED` = **silent gap**.

### 1.7 No secrets, ever

No token, password, API key, App Secret, private key, or sign-in code in any
doc, example, screenshot, or log pasted into a doc. Examples use obviously fake
values (`<redacted>`, `example.invalid`). The consistency script greps for
secret-shaped patterns and fails the build on a hit.

**`docs/inputs/` is the highest-risk layer** — RFP attachments carry credentials,
transcripts carry PII and pricing. The grep runs strictest here. Material under
NDA that cannot be committed is stored as a **pointer + hash**, not as content.

### 1.8 English for the record, Vietnamese for the conversation

Submission-facing and repo docs are English. Chat, review notes, and internal
discussion are Vietnamese. A doc never mixes the two except in a quoted user
statement.

**Explicit exception:** raw evidence in `docs/inputs/` keeps its original
language. Translating a transcript in place is interpretation and destroys its
value as evidence. The derived BRD/REQ is English; the source stays as received.

### 1.9 The as-built zone

`docs/as-built/` is the single living truth of the current codebase. It holds
only what is checked into HEAD and verified today. It is the agent's primary
read zone for the running system.

Layout:

```text
docs/as-built/
  DATA.md             # logical ERD, physical schemas and key prefixes, index matrix, lineage
  DESIGN.md           # UI and UX surfaces, five-state matrix, tokens, copy single source, a11y
  VERIFICATION.md     # traceability matrix, latest verified test run, input coverage, parity
  specs/              # deep technical specs for DEEP-budget subsystems
    storage-layout.md
    query-optimizer.md
```

**Decision, stated explicitly: `ARCHITECTURE.md` stays at the repo root
as the index into `docs/as-built/`. It is not moved into the folder.**
Reason: the consistency checker requires `README.md`, `ARCHITECTURE.md`,
and `AGENTS.md` at the repo root, and existing links, templates, and the
crystallization table point at the root file. Moving it would break the
checker and every existing link for no gain in clarity. A repo that already
uses a root `ARCHITECTURE.md` keeps it as the index; do not move the file
just to match the folder.

Rules for the zone:

- **Only HEAD-verified content.** Roadmaps, unbuilt phases, and planned
  features are forbidden in `docs/as-built/`. They belong in
  `docs/requirements/` or `docs/rfc/`. The moment a feature ships, its
  contract moves into `docs/as-built/` in the same PR.
- **Known Limits is the one exception.** A clearly labelled `Known Limits`
  section may record what the shipped system does not yet do, with a date
  and an owner. A limit recorded there is honest. A planned feature dressed
  up as a limit is vaporware and is forbidden.
- **No vaporware words** outside Known Limits: no `TODO:`, `PLANNED:`,
  or `NOT BUILT YET` in `ARCHITECTURE.md`, `DATA.md`, or `DESIGN.md`.
  This rule is a v3 addition and is not yet enforced by the checker script;
  see *The consistency check*.
- **Agents read this zone first for the running system.** A coding agent
  that is implementing or debugging reads `AGENTS.md`, then the root
  `ARCHITECTURE.md`, then `docs/as-built/DATA.md` if it touches storage,
  then `docs/as-built/DESIGN.md` if it touches UI, then the target
  package's local `README.md`. It does not read `docs/rfc/` or
  `docs/inputs/` for implementation. They are history and evidence.
- **The zone does not replace the layer order.** Data, design, and technical
  content still belong to their layers. The zone is where those layers'
  as-built files live; it is not a new layer that swallows them.

---

## 2. Evidence — `docs/inputs/`, the layer above requirements

Customer input is not a requirement. It is the raw material a requirement is
*derived* from. It lives above `docs/requirements/`, append-only, never edited.

This is the Source Graph / Derived Graph split applied to project documents:
the input is the document with a content hash, never overwritten; the BRD
outcome is a candidate claim with provenance; the `REQ` is the derived,
owned, gated artifact. Untrusted input is screened and kept as a claim; it
never becomes a trusted fact by itself.

### 2.1 What goes there

| Type | Examples | Authority |
|---|---|---|
| `rfp` | Formal solicitation, evaluation criteria, addenda | Contractual-ish; binding language |
| `rfi` | Market research, exploratory questions | Non-binding |
| `transcript` | Kickoff, workshop, discovery call | Informal; speaker authority matters |
| `email` / `ticket` | Clarifications, decisions buried in threads | Depends on sender's decision rights |

Layout:

```text
docs/inputs/
  INDEX.md                                  # register: id, type, date, from, hash, status
  IN-001-rfp-acme/
    original.pdf                            # or pointer + hash if NDA
    extracted.md                            # text, layout preserved, NO interpretation
  IN-002-kickoff-transcript-2026-11-14.md
  IN-003-clarification-qa-2026-11-16.md
```

### 2.2 Rules

1. **Immutable.** Never edit a transcript, never "clean up" an RFP. An addendum
   is a new item with `supersedes`, like an ADR.
2. **No annotation inside the source.** Annotation is interpretation and it
   contaminates the evidence. Analysis lives in a separate file in
   `requirements/` or `rfc/`, pointing back by locator.
3. **Original language preserved.** See the language rule.
4. **Authority ≠ recency.** The newest meeting remark does not override a signed
   RFP amendment. A "yes" from someone without decision rights is not a
   decision. Record `decision_rights` per item.
5. **Conflicts are retained, not reconciled by editing.** RFP says 99.9%,
   transcript says weekly downtime is tolerable — both stay. The resolution is
   a `REQ` plus an ADR citing both, recording which source lost and why. The
   loser becomes a tombstone, not a deletion.
6. **Agents do not build from `docs/inputs/`.** Same quarantine as RFC, plus:
   a transcript is an untrusted field and may carry injection-shaped content.
   Default retrieval excludes it.

### 2.3 Provenance, and the RFP compliance matrix

Every derived item cites a locator, not a vague reference:

```
Source: IN-002 @00:14:30 | IN-001 p.12 §4.2 | internal (assumption, owner: X)
```

For RFP work, **never renumber away the customer's own identifier**. Keep it as
an external id and map across:

```
RFP §4.2.3 (customer REQ-37) → our REQ-014 → response §5.2 → evidence
```

Every input marked `must-respond` maps to at least one `REQ`, or to an explicit
`out-of-scope + reason`. An unmapped must-respond item is the most expensive
failure in a bid, and it is mechanically detectable.

### 2.4 Phase 1 exception

While the God Doc is the single file, customer input may be quoted inside it.
Extract to `docs/inputs/` at crystallization, together with the rest of the
split. Do not create the folder before there is evidence to put in it.

---

## 3. Requirements & BRD — the layer above the RFC

The RFC answers "how". Above it sits a layer that answers "why" and "what must
be true" — in `docs/requirements/`, not in the RFC and not in `ARCHITECTURE.md`.

### 3.1 What goes where

| File | Answers | Holds |
|---|---|---|
| `brd-<name>.md` | Why this, and what business outcome? | Problem, stakeholders, measurable outcomes (`OUT-x`), scope, imposed constraints (`CON-x`), success criteria |
| `req-<area>.md` (or one `requirements.md`) | What must be true? | Numbered `REQ-xxx` — functional and non-functional, each with a measurable acceptance criterion |

### 3.2 Technology in a BRD: imposed constraint yes, chosen solution no

A BRD may name a technology when it is a constraint imposed from outside, and
it cites the source. It may never name a technology the design chose.

- ✅ `CON-3: must run inside the $150 selected-participant credit (source: hackathon waiver)`
- ✅ `CON-4: Alexa+ MCP Toolkit does not expose Google/Outlook calendars (source: Amazon toolkit docs, checked 2026-11-18)`
- ✅ `CON-5: 8 GB RAM ceiling on the target host (source: deployment budget)`
- ❌ "We use Postgres because it is faster" — that is a decision. It belongs in
  an ADR, and the sentence must be moved, not softened.

**The test:** would this constraint still exist if we changed our mind about
the design? If yes, it is imposed. If no, it is chosen.

### 3.3 Rules

- **One requirement, one number, one acceptance.** "Fast" is not an acceptance;
  "< 1 s median on the 20-question test set" is.
- **A requirement that cannot be measured is rewritten** — or marked
  `PROCESS-RISK` with a reason and an owner. Do not invent a number to make it
  look measurable.
- **Traceability.** Every `REQ` maps down to the RFC/ADR that implements it and
  the test that proves it. A requirement with no test is `UNVERIFIED`, never
  silently assumed met.
- **Requirements never live in the architecture doc.** If a design discussion
  produces a new requirement, write it in `docs/requirements/` first, then
  design against it.
- **No chosen solution in the BRD, no business case in the spec.** The BRD stays
  readable by a stakeholder who knows nothing about the stack; the spec stays
  checkable by an engineer who knows nothing about the business case.
- **A changed requirement re-runs its tests.** Editing a `REQ` is not a doc
  edit; it invalidates every test mapped to it until they run again.

### 3.4 Phase 1 exception — do not split early

While the God Doc is still the single file, requirements live inside it (goals,
rules, test set in the CSD). That is correct for Phase 1. Split them out only at
the crystallization trigger, together with the rest of the split.

---

## 4. Logical design — the domain, technology-free

What the data logical model does for storage, the logical design does for the
whole system: entities (`ENT-xxx`), invariants (`INV-xxx`), state machines, and
rules, with no mention of frameworks, languages, or infrastructure.

**The test: would the sentence survive a rewrite in another stack?**
If yes, it is logical. If no, it is technical, and it belongs in a spec.

A logical design that still makes sense after a full rewrite is a design. One
that does not is a technical design in disguise.

---

## 5. Component design — the unit of ownership

One component = one owner, one interface, one piece of state. Document it as a
card (template in *Templates*).

- A component that owns no state is a function, not a component — document it
  as one.
- **A component with two owners has no owner.**
- **If the "Depends on" list has no failure column, the design is unfinished.**

Example (CASANOS gateway): owns the model-call enforcement point and the
outbox; depends on the core's check endpoint (core unreachable →
`decision_unavailable`, fail-closed); does **NOT** own decisions — X3 alone
decides; does **NOT** own the token budget counter, it reports usage and the
core enforces the cap.

---

## 6. Data design (`docs/as-built/DATA.md`) — logical first, physical second

Most bad database docs fail in the same way: they start with tables. Start with
truth, then with storage. `docs/as-built/DATA.md` is the single living map of
how data is modeled, indexed, mutated, and purged across relational databases,
key-value stores, and vector stores. It is the as-built data file; the logical
and physical rules below are what that file must contain.

### 6.1 Logical model — what is true (technology-free)

No table names, no indexes, no engine names, no "Postgres" and no "SQLite"
here. If a sentence needs a technology to make sense, it belongs below.

1. **Entity-relationship diagram.** A Mermaid `erDiagram` showing every
   domain entity (`ENT-xxx`), its natural key, and exact relationship
   cardinalities. No engine names, no surrogate types, no index names here.
   In the `DATA.md` template the diagram is written as indented text inside
   the template, not as a nested fenced block, so the template still parses.
2. **Entity dictionary.** One row per `ENT-xxx`: natural identifier, single
   writer component (`CMP-xxx`), mutability (`immutable-ledger` |
   `mutable-state` | `ephemeral-lease`), and lifecycle state machine.
3. **Invariants (`INV-xxx`).** Rules that must hold in every state, each
   testable ("a work item has exactly one terminal state", "an approval is
   consumed at most once", "a learned workflow is a proposal until a human
   approves it"). Each invariant maps to a verification test or a scheduled
   integrity query.
4. **State machines.** The lifecycle of each entity (offered → in_progress →
   completed / refused / handed_back), with which transitions are legal and
   who may trigger them.
5. **Derived data.** What is computed, from what, cached or recomputed. A
   cached derivation must name its invalidation.

Example (Data Mosaic, logical): a capture is raw evidence from one source; a
fragment is one extracted claim from a capture; a golden record is the single
surviving value for one field, chosen by survivorship rules over fragments; the
vector embedding exists for similar-search recall only and never decides
survivorship alone.

### 6.2 Physical model — how it is stored and queried (technology named)

Only after the logical model is settled.

1. **Schema and key-prefix catalog.**
   - **Relational (SQLite / Postgres):** link directly to `migrations/*.sql`
     or `schema.*.sql` as the executable single source of truth — never
     retype full DDL in prose. Document table purpose, primary key choice,
     foreign-key cascade rules, and dialect translation rules where they
     matter (for example, placeholder style, `RETURNING` support, and
     rolling-deploy lock timeouts).
   - **Key-value stores:** document the exact key and value dictionary as a
     table: prefix, key layout with offsets and sizes, endianness and
     alignment, value encoding and compression. A key-value store is not
     exempt from the catalog just because it has no DDL file; the catalog
     table is its DDL. Keep the example generic: name the prefix and the
     layout shape, not a repo's private byte values.
   - **Vector stores:** document the embedding column or store, its model
     and version and dimension per row, and the rule that vector recall
     never decides survivorship or any other ledger decision alone.
2. **Query-to-index matrix (`IDX-xxx`).** Every index or composite key order
   must justify its existence by naming the exact query pattern it serves,
   its access complexity, and its write-amplification trade-off. An index
   without a named query is dead weight. A slow query without an index is a
   missing row in this matrix. The matrix is the place where the
   `IDX-xxx` ID is defined exactly once.
3. **Concurrency, mutability, and outbox rules.**
   - **Single-writer rule:** name the exact component and lock or
     transaction boundary allowed to mutate each table or key prefix.
   - **Append-only vs. in-place:** event logs and audit trails are strictly
     append-only; revocations and corrections append new rows rather than
     running `UPDATE` or `DELETE` in place.
   - **Durable timers and outboxes:** document crash-recovery tables and
     durable cursors and their atomic claim semantics, so N instances fire
     at most once. The outbox pattern (append + durable acknowledgement
     offset, crash can only resend, never lose) is the reference here.
4. **Lineage: source vs. derived data.** Separate primary evidence (cannot
   be reconstructed if lost) from derived projections, embeddings, and
   clusters (can be rebuilt from the event log or source records). Every
   derived store must state its **rebuild command** and its **invalidation
   trigger**. A derived store with no rebuild command is an unrecoverable
   store.
5. **Retention, compaction, and migrations.**
   - Retention and time-to-live purge rules, soft vs. hard delete, PII
     redaction before write, and background compaction budgets.
   - Migration safety: append-only numbered migrations, lock-timeout
     guards, and explicit backup steps for any destructive change. No
     manual `ALTER` in production. A migration that loses data says so in
     its own header, with the backup step next to it.

### 6.3 Rules that apply to both layers

- **One writer per fact.** If two components write the same row, the ownership
  is already wrong — fix the ownership, not the locking.
- **No magic values.** `0` never means "unknown" (an unknown token count is
  `NULL` / a distinct `usage_unknown` event, never `0`); a sentinel string is
  never a state.
- **Every enum is closed or open, stated.** A closed enum lists its values and
  the migration that adds one; an open enum says so and names who may add
  values.
- **The spec names the verification.** Each `INV` maps to a test or a query
  that checks it ("no work item has two terminal states" as a scheduled query,
  not a hope).
- **Tables, keys, and indexes link back to the logical model.** A table or a
  key prefix that appears in the physical catalog but not in the logical
  model is undocumented design — add it to the logical model or delete it
  from the catalog. The same rule applies in reverse: a logical entity with
  no physical home is an unbuilt entity.

---

## 7. UI & UX design (`docs/as-built/DESIGN.md`) — behavior and states over pixels

A system's interface is an architectural contract with the human in the loop.
`docs/as-built/DESIGN.md` documents visual systems, interaction state
machines, copy guardrails, and accessibility invariants so coding agents
never invent inconsistent screens, raw error dumps, or broken keyboard flows.
This section was missing from v2 entirely. It is the strongest addition in
v3, because the projects this playbook serves do have interfaces that are
designed carefully and that agents will otherwise re-invent badly.

### 7.1 Surfaces & viewport modes (`UI-xxx`)

List every human-facing surface, its target hardware and viewport, and its
entry route or query flag. Each surface gets a stable `UI-xxx` ID, defined
exactly once in `DESIGN.md`.

- **Desktop / web dashboard** — for example a fleet monitor, a kanban board,
  a council chat.
- **Mobile PWA** — touch targets at least 44px, one-tap quick replies,
  consent preview before any high-stakes action.
- **10-foot TV / kiosk mode** — for example a single-screen layout, scaled
  typography, D-pad and arrow-key focus-ring navigation, dev panels hidden.
  Verified example: AccessBell presents a 10-foot TV presentation with
  D-pad navigation and 44px targets.
- **Voice / CLI surfaces** — text-to-speech-safe output, terminal width and
  color fallbacks, no information carried by color alone.

A surface that is not listed here does not exist as far as the docs are
concerned. A new screen starts as a `UI-xxx` row, not as a screenshot pasted
into a chat.

### 7.2 Interaction state matrix (mandatory per surface)

Every `UI-xxx` component or screen must define its exact behavior across all
five runtime states — no happy-path-only mockups:

| State | Trigger | Visual & Copy Behavior | Allowed User Actions |
|---|---|---|---|
| **Empty / First-run** | 0 items in store | Voice-consistent empty state, or a labelled demo seed banner (`DEMO DATA`) | Primary CTA or seed toggle |
| **Loading / Pending** | Initial fetch, or waiting on a model or host | Skeleton or thinking indicator; preserve the user input draft and focus | Cancel, or navigate away without blocking |
| **Live / Streaming** | Active server-sent events or WebSocket | Incremental update outside the clock and focus region; a `Pause live` toggle | Full interaction |
| **Degraded / Stale** | Heartbeat past threshold, tier-2 timeout, host offline | Explicit badge (`STALE`, `Host offline`); keep the tier-1 alert visible | Safe fallback actions (for example stop an escalation, local retry) |
| **Error / Rejected** | Network 4xx or 5xx, model down | **Plain-language message only** (never raw JSON or stack traces); collapse repeats | Retry, or copy a diagnostic command |

Two rules sit above the table and are not negotiable:

- **Streaming updates never steal focus or wipe a draft.** A re-render that
  clears the composer a user is typing in is a bug, not a refresh.
- **A state with no defined behavior is an unbuilt state.** If the matrix
  row is blank, the surface is not finished, even if the happy path works.

### 7.3 Human-in-the-loop gates & truthful copy

- **Truthful capabilities.** UI taglines, footers, and confirmation dialogs
  must state exactly what the system does automatically versus what waits
  for human consent. Never write "applies only what you approved" if an
  opt-in flag can merge autonomously. The Coven redesign work is the
  reference case: copy that said the user merges, or that a chair agent
  decided the merge, contradicted the human-merge decision and had to be
  fixed in the UI, not just in the docs.
- **Consent and preview protocol.** High-stakes actions (sharing logs
  externally, approving a build plan, merging a branch) follow
  `Preview -> Explicit Consent / Admin Scope -> Audit Log -> Revoke`.
- **Single source of truth for copy and i18n.** Never scatter user-facing
  strings or translations across JavaScript and HTML templates. All UI
  labels, challenge questions, and bilingual strings (English and
  Vietnamese) live in a single canonical module, verified for length
  bounds and text-to-speech safety. Verified example: AccessBell keeps
  English and Vietnamese captions in a single source in `captions.py`,
  kept short and text-to-speech-safe so a screen reader and a voice line
  read the same thing.
- **Seeded and estimated data is labelled, never hidden by styling.**
  Seeded, estimated, or unproven data carries a visible label in the UI.
  No fake live data. No scripted chat presented as a live council.

### 7.4 Design tokens, motion & accessibility guardrails

- **Semantic tokens.** Define brand, surface, and urgency colors as named
  CSS variables or tokens. Verified example: Coven uses pumpkin-orange and
  violet `#9147FF` as brand moments, with a Specter skin as the character
  layer over neutral ops tokens. Urgency and status must **never rely on
  color alone** — always pair color with an explicit text label or icon.
- **Motion and `prefers-reduced-motion`.** Every animation (slide-ins,
  character states, typing effects) must halt immediately under
  `prefers-reduced-motion: reduce`.
- **Live regions and focus.** Streaming updates use `aria-live="polite"`
  (or `assertive` for high-urgency alerts) without stealing keyboard focus
  or wiping active composer drafts on re-render.
- **Keyboard and D-pad navigation.** Every action reachable by pointer must
  be reachable by keyboard or D-pad, with a visible focus ring. A screen
  that can only be used with a mouse is unfinished.

---

## 8. Technical design — how the logical design is built

The technical design names the technology and the enforcement: protocols,
storage, concurrency, timeouts, retries, observability. It lives in
`docs/as-built/specs/` and **every claim in it maps to code or a test**.

Code in a spec is a **contract** (schema, DDL, public signature) or short
pseudocode labelled *illustrative*. A full function body pasted into a doc is
never compiled and never tested, so it drifts and it carries its bugs into
every reader that copies it. If a snippet is normative, it is extracted from
source, not typed into prose.

### 8.1 How the layers fit the 2-phase workflow

**Phase 1 (God Doc):** logical design first, component sketch second, technical
details only where they change the design ("foreground-only inference" changes
the whole UX, so it belongs in Phase 1 even though it is technical).

**Phase 2 (crystallize):**

| From the God Doc | To |
|---|---|
| Quoted customer evidence | `docs/inputs/` |
| Requirements, goals, acceptance | `docs/requirements/` |
| Logical design | `ARCHITECTURE.md` (context, topology, contracts) |
| Component cards | `ARCHITECTURE.md` component table + one spec per component if big enough |
| Technical design | `docs/as-built/specs/` |
| Data logical | `ARCHITECTURE.md` data section |
| Data physical | `docs/as-built/DATA.md`, DDL linked from migrations |
| Design and UI | `docs/as-built/DESIGN.md` |
| Decisions + discard list | `docs/adr/` |
| Demo script, pitch, runbook | `docs/operations/` |

**A component or a table that appears in the technical spec but not in the
logical design is undocumented design** — add it to the logical design or
delete it from the spec. The same rule applies to a surface in
`DESIGN.md` with no component behind it, and to an index in `DATA.md`
with no query behind it.

### 8.2 In-code documentation — where implementation detail lives

Because `docs/as-built/` bans implementation code dumps (over 15 lines),
low-level implementation mechanics live directly beside the code, in two
forms. This section fills the gap v2 left: v2 said where code must not go,
but never said where the detail it replaces should live.

1. **Package / module `README.md`.** One per package or module, placed
   beside the code (for example `internal/<pkg>/README.md` or
   `src/<module>/README.md`). Short: fill every section or delete it.
   No line cap is stated, because a cap with no reason behind it is not a
   guardrail. Contents:
   - Single-sentence responsibility and owning `CMP-xxx` ID.
   - Internal file map, one line per file.
   - Concurrency and locking hierarchy specific to that package (for
     example, which lock is always acquired first).
   - Memory lifetime rules specific to that package (for example, whether
     returned slices alias shared memory and when they stop being valid).
   - The exact command to run that package's isolated unit tests and
     benchmarks.
2. **Public symbol docstrings (GoDoc / Python docstrings / TSDoc).**
   Required on every exported type, interface, and function, at the depth
   the depth budget demands (see below). Do not restate the function name
   in prose; state the **execution contract**:
   - **Invariants and preconditions:** alignment requirements, valid
     parameter ranges.
   - **Ownership and lifetime:** whether returned slices or buffers alias
     shared memory, whether the caller must call `Release()` or `Close()`.
   - **Concurrency safety:** safe for concurrent use, or requires external
     synchronization.
   - **Failure behavior:** exact sentinel errors returned and whether
     partial results are valid on error.

**Depth-gated, like everything else in this playbook:**

- `DEEP` — required: a package `README.md` and full contract docstrings
  on every public symbol.
- `STANDARD` — required: a component card plus short docstrings on public
  symbols (contract in one or two lines, not a restated name).
- `SKETCH` — one paragraph in the component card; docstrings only where a
  caller could misuse the function without one.

A package `README.md` that restates the spec is duplication, not
documentation. It documents what is true only in that package: its locks,
its file map, its test command. Anything true of the whole system belongs
in `ARCHITECTURE.md` or the relevant spec, not in a package README.

---

## 9. The 2-phase workflow

> God Doc is source code. Chat LLM is the compiler. Coding agent is the runtime.

### 9.1 Phase 1 — Ideation (0 → 1): the God Doc

When designing a new system or a major subsystem, do not fragment your thoughts
across files. One file, one design, everything in it:

- Create `docs/rfc/NNN-feature-name.md` (or a CSD file, same role).
- Allowed content: brainstorming, rough diagrams, end-to-end flows, prototype
  structs, benchmark targets, open questions, doubts. Contradictions are assets
  here — they are how trade-offs surface.
- **Feed the single file to a chat LLM** to challenge assumptions and stress-test
  limits. A God Doc is a safe harbor for being wrong early.
- **A coding agent does not build from a God Doc.** Agents read partially, by
  retrieval; they will find a stale section and never see the note that
  supersedes it. Agents consume crystallized artifacts only.
- Tag ideas from day one: `IDEA → DECIDED → VERIFIED | SUPERSEDED`. Use stable
  IDs from the first line, so extraction later is mechanical, not archaeology.

### 9.2 Phase 2 — Crystallization: the split trigger

Split when any of these is true. **The first three are events; the last two are
smells.**

1. Core decisions are finalized and implementation is starting from them.
2. An executor appears that reads partially — a coding agent, a new teammate.
3. A contradiction becomes dangerous: two readings produce two behaviors.
4. The document passes ~800 lines (a trigger, not a law — adjust per repo; the
   point is "too long to hold in one head", not the number).
5. The file starts accumulating pasted production code, test logs, or
   refactoring changelogs.

### 9.3 How to crystallize — in order, do not skip

1. **Freeze the RFC.** Status `Implemented`. It stays as history.
2. **Quarantine it.** Add the banner and the extraction map at the top:

   ```
   HISTORICAL — superseded by the extraction map below.
   Do not implement from this file.

   Extraction map:
     §3 proposed design   → ARCHITECTURE.md (CMP-gateway, FLOW-ingest)
     §4 discard list      → ADR-004, ADR-005
     §6 binary layout     → docs/as-built/specs/storage-layout.md (INV-011..INV-018)
     §7 test set          → tests/test_rules.py (G-01..G-20)
   ```

3. **Extract evidence** → `docs/inputs/` (`IN-xxx`, immutable, with locator).
4. **Extract requirements** → `docs/requirements/` (`OUT`, `CON`, `REQ`).
5. **Extract why + discard list** → `docs/adr/NNN-*.md` (one ADR per decision,
   not one ADR per RFC).
6. **Extract topology, contracts, failure modes** → `ARCHITECTURE.md`; component
   cards, data model, runtime flows to their layers per the table in *How the layers fit the 2-phase workflow*.
   Data physical goes to `docs/as-built/DATA.md`; UI and UX goes to
   `docs/as-built/DESIGN.md`.
7. **Extract layouts, algorithms, guardrails** → `docs/as-built/specs/*.md`,
   each invariant numbered `INV-xxx` with a `Verified by` handle. Move DDL
   and API schemas to source; docs link them. Delete raw implementation
   code. Write the package `README.md` and docstrings for the code that
   ships, per *In-code documentation*.
8. **Parity check — the step that makes the split trustworthy.** Every `IN`, `OUT`, `CON`, `REQ`, `INV`, `GR`, `CMP`, `ENT`, `FLOW`, `IDX`,
   `UI`, and test case in the
   RFC landed **exactly once**, somewhere. Nothing lost, nothing duplicated,
   all links resolve. A loss is a crystallization bug, not an acceptable
   edit. Record the parity result in the extraction map.

### 9.4 After crystallization

Artifacts are derived from the God Doc, not a parallel copy of it. When the
design changes: fix the source (a new ADR, an amended requirement, a new input),
then re-derive the affected artifacts. **Never patch an artifact locally while
the source still says otherwise** — that is how the two drift apart.

A contradiction found during crystallization is a compile error: it goes back
to the source, not into a silent local fix.

---

## 10. Guardrails for authors and agents

- **No code dumps.** Never paste a full function body, boilerplate loop, or
  helper implementation into `ARCHITECTURE.md` or `docs/as-built/specs/`.
  Allowed: data contracts (JSON schema, SQL DDL, Protobuf, public
  struct/interface signatures) and concise pseudocode (< 15 lines) for a
  genuinely complex algorithm, labelled illustrative. The 15-line limit
  applies to implementation code blocks in a repo's `ARCHITECTURE.md` and
  specs/. It does not apply to template blocks in this playbook: a template
  is the thing being shown, not implementation code pasted into a design doc.
- **No refactoring logs.** "Lines eliminated", "DRY cleanup", PR-level churn
  belong in commit messages and PR descriptions, never in a design doc.
- **Every design doc states non-goals and a discard list.** What the system
  intentionally does not do, and which seductive alternatives were rejected and
  why. A design without a discard list has not been thought through.
- **Hard numeric guardrails per subsystem.** Max memory, timeout ms, max join
  cardinality, max recursion depth, token budget, rate limits — with the
  enforcement mechanism and the fallback on breach. **A guardrail without a
  number is a wish.** The number itself lives in the `REQ`; the guardrail row
  carries the enforcement.
- **Depth budget — depth follows risk, not uniformity.** Declare per component:
  - `DEEP` — novel and risky (a custom GC, an mmap layout) → its own spec.
  - `STANDARD` — ordinary component → a card and a section.
  - `SKETCH` — known and boring → one paragraph.
  Uniform depth spends the same prose on a refactor summary and on the crown
  jewel. That is how a 3,000-line doc hides its own gaps.
- **Doc ownership and freshness.** Every permanent doc carries a header: owner,
  last verified date, verified against which HEAD. When HEAD moves past the
  verified commit and the doc's area changed, the doc is stale until
  re-verified. **Stale is a state, not a shame — but it must be visible.**
- **No silent edits to frozen docs.** See the fail-closed rule.
- **No numbers without a source.** See SSOT.

---

## 11. Templates

Keep templates short. **A template that is longer than the doc it produces is
not a template, it is a burden.** Fill every section or delete it — an empty
section heading is a lie about completeness. A section may be answered
`N/A — reason`; it may not be silently skipped.

**A note on fences in this section.** Template blocks are fenced as markdown.
A template block never contains a nested fenced block. Where a template needs
to show a diagram, the diagram is written as indented text inside the template
block, not as a second fence. A template block's own length is not subject to
the 15-line limit in *Guardrails for authors and agents*: that limit is for
implementation code inside a repo doc, not for the template itself. A template that breaks this rule breaks the
fence-count check in *The consistency check*.

### 11.1 Input item — `docs/inputs/IN-xxx-*.md`

```yaml
---
id: IN-002
type: rfp | rfi | transcript | email | workshop | ticket
received: 2026-11-14
from: "Nguyen Van A — Solution Sponsor, ACME"
decision_rights: sponsor | influencer | observer
channel: "kickoff meeting, Teams"
hash: sha256:...
confidentiality: public | internal | nda
locator: timestamp | page-section | message-id
supersedes: null | IN-001 §4.2
must_respond: true | false
owner: Duy
---
```

Body: the content as received, original language, no annotation.
If NDA: a pointer to the controlled location + hash, not the content.

### 11.2 BRD — `docs/requirements/brd-<name>.md`

```markdown
# BRD: [Name]
- Owner: [name] · Last verified: [date] · Status: Draft | Accepted
- Stakeholders: [who decides, who is affected]

## 1. Problem
What is broken or missing, in business terms. No chosen solution.

## 2. Outcomes (measurable)
- OUT-1: [outcome + number + date] · Source: IN-xxx @locator

## 3. Scope & non-goals
In scope: […]. Explicitly out: […].

## 4. Imposed constraints
- CON-1: [budget / deadline / legal / platform / existing estate] — source: […]
  (Technology names are allowed here, and only here, with their source.)

## 5. Success criteria
[The numbered list a reviewer checks at the end; each maps to REQ-xxx.]
```

### 11.3 Requirements — `docs/requirements/req-<area>.md`

```markdown
# Requirements: [Area]
- Owner: [name] · Last verified: [date]

## REQ-001 — [short imperative title]
- Statement: [what must be true]
- Type: functional | non-functional
- Priority: must | should | could
- Source: IN-002 @00:14:30 | OUT-1 | CON-2 | internal (assumption, owner: X)
- External-id: RFP §4.2.3 / customer REQ-37   # never renumber away the customer's id
- Acceptance: [how to measure it — number, test set, or log]
- Implemented by: RFC-NNN / ADR-NNN
- Verified by: [test file :: test name] | UNVERIFIED — no test yet |
               PROCESS-RISK — [why not machine-checkable, owner]
```

### 11.4 `ARCHITECTURE.md` — system contract (root index)

```markdown
# [System] — Architecture
One sentence: what it does, and where its boundary is.
Owner: [name] · Last verified: [date] · Against HEAD: [sha]
Repo settings: split trigger [n] lines · AGENTS.md cap [n] lines
As-built: DATA.md, DESIGN.md, VERIFICATION.md, specs/ (see Related docs)

## 1. Goals & Non-Goals
| Goal | Non-Goal |
|---|---|
| [capability, cites REQ-xxx for the number] | [explicitly excluded] |

Owns only: [responsibilities no other component has]

## 2. Context & Topology
[Diagram — actors, external systems, trust boundaries]
| Component | Interface | Responsibility | Card |
|---|---|---|---|
| CMP-x | [internal API / HTTP / MCP] | [role] | [link] |

## 3. Runtime flows
FLOW-x: Step 1 -> Step 2 -> Step 3 (state + latency at each step)
(One canonical flow. Every other doc links here; none restates it.)

## 4. Data contracts
Logical model: [ENT-xxx, relationships, invariants]
Physical: [link to docs/as-built/DATA.md and to migrations / contracts — do not retype the DDL]

## 5. Budgets & guardrails
| Guardrail | Requirement (owns the number) | Enforcement | Fallback on breach |
|---|---|---|---|
| GR-001 | REQ-014 | [mechanism] | [fail-closed / degrade] |

## 6. Security & concurrency
Auth boundaries, locking order / lock-free invariants, retention & PII.

## 7. Failure modes
| Scenario | Behavior | Recovery / audit |
|---|---|---|

## 8. Deployment & config
[Environments, topology, config vars — link docs/operations/]

## 9. Traceability
| Invariant / Requirement | Verified by |
|---|---|
| INV-001 | [test file :: test name] |
| REQ-001 | [test file :: test name] or UNVERIFIED — no test yet |

## 10. Decision index
[ADR-001 … with one-line titles]

## 11. Related docs
[README, inputs, requirements, operations, docs/as-built/DATA.md,
docs/as-built/DESIGN.md, docs/as-built/VERIFICATION.md, docs/as-built/specs/]
```

This file stays at the repo root. It is the index into `docs/as-built/`.
It does not duplicate `DATA.md`, `DESIGN.md`, or the specs; it links to
them. If a repo moves this file into a subfolder, the checker script's
required-file check fails — see *The consistency check*.

### 11.5 Component card

```markdown
## Component: [name] (CMP-xxx)
- Owner: [name] · Interface: [API / MCP / internal call] · Depth: DEEP|STANDARD|SKETCH
- Owns (state): [exactly what it is the single writer of]
- Depends on: [component → what happens when it is down]
- Does NOT own: [neighbouring state it reads but never writes]
- Invariants: [INV-xxx → Verified by]
- Failure modes: [scenario | behavior | recovery]
- Tests: [the suite that proves the interface contract]
```

### 11.6 `docs/rfc/NNN-title.md` — God Doc / CSD

```markdown
# RFC-NNN: [Title]
- Status: Draft | In Review | Accepted | Rejected | Implemented
- Author: [name] · Created: [date] · Target: [milestone]

(When Implemented, add here: HISTORICAL banner + extraction map + parity result)

## 1. Context & problem
## 2. Goals & Non-Goals
## 3. Proposed design        # any depth, any format; contradictions allowed
## 4. Discard list
| Rejected approach | Fatal flaw | Chosen instead |
|---|---|---|
## 5. Open questions
## 6. Rollout & operations
## 7. Extraction map         # filled at crystallization
```

### 11.7 `docs/adr/NNN-title.md` — decision record

```markdown
# ADR-NNN: [Short imperative title]
- Status: Proposed | Accepted | Superseded by ADR-XXX
- Date: [date] · Related: [RFC-NNN, REQ-xxx, IN-xxx]

## Context
The constraint or force that required a decision (2–4 sentences).

## Decision
The chosen design, stated directly.

## Rejected alternatives
- Option A: why it failed the constraints.
- Option B: why it failed the constraints.

## Consequences
- Positive: [gains]
- Negative: [trade-offs and what must be managed]

## Verification
[INV-xxx / test file :: test name that proves this holds]
```

### 11.8 `docs/as-built/specs/<subsystem>.md` — deep spec

```markdown
# Spec: [Subsystem]
- Owning package: [path] · Depth: DEEP
- Related ADRs: ADR-001, ADR-002
- Owner: [name] · Last verified: [date] · Against HEAD: [sha]

## 1. Invariants
| ID | Must always hold | Verified by |
|---|---|---|
| INV-001 | [testable statement] | [test file :: test name] |

## 2. Layout
[Byte/wire layout with exact offsets, sizes, endianness]

## 3. State machine & algorithms
Transitions, complexity, locking order. Public interfaces + short pseudocode
only — never a full source file.

## 4. Guardrails
| GR-xxx | Requirement | Enforcement | Fallback |
|---|---|---|---|

## 5. Edge cases & safety
Crash recovery, resource exhaustion (disk full, OOM), fail-closed behavior.
```

### 11.9 `docs/as-built/DATA.md` — data architecture & schema catalog

This template replaces the thin data view that was v2 template 10.9. That
six-line view is not kept alongside it; keeping both under different numbers
would split the single source of truth for data. The diagram below is
indented text inside this template block, not a nested fenced block.

```markdown
# [System] — Data Architecture (As-Built)
- Owner: [name] · Last verified: [date] · Against HEAD: [sha]
- Executable schemas: [link to migrations/ or schema files]

## 1. Logical Model (Technology-Free)

    erDiagram
        ENT_A ||--o{ ENT_B : "verb"

| Entity ID | Name | Natural Key | Single Writer (CMP-xxx) | Mutability | Lifecycle States |
|---|---|---|---|---|---|
| ENT-001 | [name] | [key] | CMP-x | append-only / mutable | s1 -> s2 -> s3 |

| Invariant ID | Must always hold | Verified by |
|---|---|---|
| INV-001 | [testable statement] | [test file :: test name, or scheduled query] |

## 2. Physical Schema & Key-Prefix Catalog

| Table / Prefix | Engine | Key Structure / PK | Value / Columns | Encoding & Alignment | Purpose |
|---|---|---|---|---|---|
| [table or prefix] | [engine] | [key layout or PK] | [columns or value] | [endianness, padding] | [query it serves] |

## 3. Query-to-Index Matrix

| Index ID | Table / Prefix | Definition | Serves Query Pattern | Complexity | Write Cost |
|---|---|---|---|---|---|
| IDX-001 | [table] | [index definition] | [exact query pattern] | [access complexity] | [write trade-off] |

## 4. Lineage: Source vs. Derived Data

| Store / Table | Class | Derived From | Rebuild Command | Invalidation Trigger |
|---|---|---|---|---|
| [store] | source / derived | [source records or event log] | [rebuild command, or N/A for source] | [trigger] |

## 5. Retention, Compaction & Migration Safety

- Retention & TTL purge: [rules + env vars]
- Compaction / GC guardrails: [thresholds, CPU and latency budgets]
- Migration policy: [lock timeouts, rollback and backup rules]
- PII: [where it lives, redaction before write, deletion rule]
```

### 11.10 `docs/as-built/DESIGN.md` — UI/UX & interaction contract

```markdown
# [System] — UI/UX & Interaction Design (As-Built)
- Owner: [name] · Last verified: [date] · Against HEAD: [sha]
- Copy / i18n single source: [e.g. backend/captions.py -> /api/ui-strings]

## 1. Surfaces & Viewport Modes
| Surface ID | Name | Route / Flag | Target Viewport | Input Mode |
|---|---|---|---|---|
| UI-001 | [name] | [route or flag] | [viewport] | [keyboard / touch / D-pad] |

## 2. Interaction State Matrix
| Surface | Empty / Seed | Loading / Pending | Live / Streaming | Degraded / Stale | Error |
|---|---|---|---|---|---|
| UI-001 | [behavior] | [behavior] | [behavior] | [behavior] | [plain-language rule] |

## 3. Human-in-the-Loop Gates & Copy Rules
- Consent / approval flows: [Preview -> Consent -> Audit -> Revoke]
- Forbidden copy claims: [statements that must never appear unless true in code]
- Localization & TTS bounds: [max chars, forbidden symbols, single source file]

## 4. Visual Tokens & Accessibility Guardrails
- Brand & semantic tokens: [table of CSS vars / hex + contrast ratio]
- Urgency encoding: [color + mandatory text or icon pairing]
- Motion & focus: [reduced-motion rule, aria-live boundaries, focus ring]
```

### 11.11 Runtime view

```markdown
## Canonical flow     # ONE home. Every other doc links here.
## Scenarios          # FLOW-xxx, sequence per scenario (happy + edge)
## Ordering & concurrency   # locks, idempotency, single-writer rules
## Budgets & timeouts       # cite REQ for the number
## Degradation        # failure → behavior → recovery/audit
```

### 11.12 Verification / traceability

```markdown
# Verification
- Owner: [name] · Last verified: [date] · Against HEAD: [sha]
- Run log: [path + date + HEAD]

| Requirement | Component | Entity / Flow | Index / Surface | Verified by |
|---|---|---|---|---|
| REQ-001 | CMP-x | ENT-y / FLOW-z | IDX-001 / UI-001 | tests/test_a.py::test_b |

## Input coverage (RFP)
| IN item | External id | Our REQ | Response § | Status |
|---|---|---|---|---|
| IN-001 p.12 | RFP §4.2.3 | REQ-014 | §5.2 | addressed |
| IN-001 p.19 | RFP §6.1 | — | — | out-of-scope + reason |

## Process risks
[Invariants not enforceable by code — reason + owner]

## Crystallization parity
[RFC-NNN: every IN, OUT, CON, REQ, INV, GR, CMP, ENT, FLOW, IDX, UI, and test case landed exactly once — result + date]
```

### 11.13 `AGENTS.md`

See *Agent rules*; paste that block, keep it under the cap.

### 11.14 Package `README.md` — local code doc

```markdown
# Package <pkg> (Owns: CMP-xxx)

One sentence: what this package does and what state it owns.

## Files
- file_a.go — [role]
- file_b.go — [role]

## Concurrency & Memory Invariants
- Locking order: [e.g. acquire mu before shard locks]
- Memory lifetime: [e.g. zero-copy slices valid only within iterator callback]

## Verify
[exact command to run this package's tests, e.g. go test -race ./internal/<pkg>/...]
```

Short: fill every section or delete it. No line cap is stated. The depth
gate in 8.2 decides whether this file is required, not a number.

---

## 12. The consistency check — an honest split

**A script cannot verify that a doc is true. It can verify that a doc is
checkable.** This playbook draws that line explicitly, because drafts that
blur it produce false confidence.

### 12.1 What the script checks today

This is what `scripts/check_docs_consistency.py` checks today, as shipped
with the v2 playbook. Do not read more into the list than it says. The
script was not updated for v3 in this task, and *V3 additions not yet in the script* lists what
that leaves out.

Structure and hygiene, as implemented today:

- Required files exist (`README.md`, `ARCHITECTURE.md`, `AGENTS.md`) at the
  repo root.
- Internal links resolve; no link points at a missing file or anchor.
- Every permanent doc has an owner and a last-verified date.
- No code fence longer than 15 lines in `ARCHITECTURE.md` and in
  `docs/specs/` as the script checks it today. Specs that have moved to
  `docs/as-built/specs/` are NOT yet covered by this check — see *V3 additions not yet in the script*.
- No secret-shaped patterns (API keys, tokens, private-key headers) —
  strictest on `docs/inputs/`.
- Line-count warnings at the split trigger and the `AGENTS.md` cap.

Identity and traceability, as implemented today:

- A `REQ-xxx` referenced from `ARCHITECTURE.md` or an RFC is defined in
  `docs/requirements/`. The script checks the id exists, not that the
  requirement is satisfied.
- Traceability rows in `ARCHITECTURE.md` name test files that exist. The
  script fails if the file is missing — it does not claim the test passes.

Frozen docs, as implemented today:

- A frozen doc containing a TODO or FIXME marker fails the check.

### 12.2 V3 additions NOT YET IN THE SCRIPT — UNVERIFIED

The following are rules in this playbook, not checks in the script. Each
one is marked here as **NOT YET IMPLEMENTED** in the checker. Claiming the
script enforces any of them would be a false claim, and this playbook does
not make it.

- **IDX-xxx and UI-xxx ID resolution.** Every `IDX-xxx` referenced anywhere
  is defined exactly once in `docs/as-built/DATA.md`, and every `UI-xxx`
  referenced anywhere is defined exactly once in
  `docs/as-built/DESIGN.md`. Not yet implemented.
- **Must-respond mapping beyond REQ existence.** Every `IN` marked
  must-respond maps to at least one `REQ`, or to an explicit
  `out-of-scope + reason`. The script today checks that a referenced `REQ`
  exists; it does not check that every must-respond `IN` is covered. Not
  yet implemented.
- **Quarantine banner check beyond frozen-doc TODO.** Crystallized RFCs
  must carry the HISTORICAL banner and an extraction map, and no normative
  artifact may cite `docs/rfc/` or `docs/inputs/` as a build source. The
  script today checks frozen docs for TODO markers only. Not yet
  implemented.
- **Vaporware ban in `docs/as-built/`.** No `TODO:`, `PLANNED:`, or
  `NOT BUILT YET` outside a clearly labelled Known Limits section in
  `ARCHITECTURE.md`, `DATA.md`, or `DESIGN.md`. Not yet implemented.
- **Schema-to-DATA.md sync.** Every table in the latest migration, and
  every key prefix in the key-prefix catalog's source, is listed in
  `docs/as-built/DATA.md`. The check must run against the latest
  migration only, not the whole migration history, or it will flag tables
  that were legitimately renamed or dropped. Not yet implemented.
- **Fence check on the new specs path.** The 15-line fence check must also
  cover `docs/as-built/specs/`, `docs/as-built/DATA.md`, and
  `docs/as-built/DESIGN.md`, not only `ARCHITECTURE.md` and the old
  `docs/specs/` path. Not yet implemented.
- **ID resolution for the full ID table.** The v2 text already promised
  that every `IN`, `REQ`, `INV`, `GR`, `CMP`, and `ADR` resolves exactly
  once, and that non-functional requirement numbers appear once, in
  `req-*`, with guardrail rows citing the `REQ`. That promise is also not
  fully implemented in the script as shipped. It is carried into v3 as an
  unimplemented requirement, not as a passing check.

Until the script is updated, these checks are a human review checklist,
not a CI gate. The update is a separate task: port the checker, add the
checks above, wire it into CI, and test it on a fixture before claiming
any of them pass.

### 12.3 What only tests can check

The script verifies the mapping exists, not the truth:

- Every invariant in the traceability matrix names a test file that exists. The
  script fails if the file is missing — **it does not claim the test passes.**
  "Tests pass" is established by running them and attaching the log, never by
  the script.
- Every SLO names a measurement (script, dashboard, or benchmark command).
- A `REQ-xxx` referenced from `ARCHITECTURE.md` or an RFC is defined in
  `docs/requirements/`. The script checks the id exists, not that the
  requirement is satisfied.
- A changed `req-*` file re-runs every test mapped to it.
- Whether an interpretation of customer evidence is correct: only review knows.

Run it in CI on every docs change. A failing check blocks the PR; **a passing
check means "checkable", never "correct".**

---

## 13. Agent rules (paste into `AGENTS.md`)

```markdown
## Documentation rules for agents

1. Read `AGENTS.md` and `ARCHITECTURE.md` first, then the spec for the subsystem
   you are touching. Do not modify code before you know the boundaries and the
   hard guardrails. Read order: AGENTS.md -> ARCHITECTURE.md (root index) ->
   docs/as-built/DATA.md if touching storage -> docs/as-built/DESIGN.md if
   touching UI -> the target package's local README.md.

2. Precedence:
   intent    → docs/requirements/req-* > ARCHITECTURE/specs > ADR > RFC
   technical → contracts + ARCHITECTURE/specs > ADR > RFC
   Requirements never dictate mechanism. A conflict between the two axes is not
   yours to resolve: stop, record an open question, ask the owner.

3. Retrieval exclusions: do not read `docs/rfc/`, `docs/inputs/`, or demo
   runbooks for implementation. They are history, evidence, and presentation.
   Any RFC marked HISTORICAL is never a build source. Do not read
   docs/as-built/ as a proposal: it describes only what is in HEAD today.

4. Where to write:
   - Raw customer evidence → docs/inputs/IN-xxx (immutable; never edit, never
     annotate inside, never translate in place)
   - Business requirement or BRD → docs/requirements/req-*.md / brd-*.md.
     Number it REQ-xxx, give it a measurable acceptance and a source locator.
     Never invent a requirement inside ARCHITECTURE.md or a spec.
   - New feature brainstorm / multi-component design → docs/rfc/NNN-*.md
   - A permanent trade-off → docs/adr/NNN-*.md (new file; never edit an existing
     ADR except its Status field)
   - Public APIs, schemas, failure modes → ARCHITECTURE.md
   - Byte layouts, protocols, algorithm bounds → docs/as-built/specs/*.md
   - Data model, indexes, lineage → docs/as-built/DATA.md
   - Surfaces, states, tokens, copy rules → docs/as-built/DESIGN.md
   - DDL, API schema → contracts / migrations; docs link them
   - Package-local locks, file map, test command → the package README.md
   - Execution contract for a public symbol → its docstring (see *In-code documentation*)

5. Anti-bloat: never paste implementation functions (>15 lines) or refactoring
   line-counts into .md files. Contracts and invariants only.

6. Numbers: every number needs a source (test, log, pin, commit) and a date. A
   non-functional requirement target belongs to its REQ; cite the REQ, do not
   restate the number. If you cannot source it, write UNVERIFIED or leave it out.

7. IDs: reference IN/REQ/INV/GR/CMP/IDX/UI/ADR by ID, never by section number.

8. On ambiguity: choose the fail-closed option, record an open question, never
   invent a rule.

9. Run `python scripts/check_docs_consistency.py` before finishing any docs
   task. A passing check is necessary, not sufficient — re-read the doc against
   the code yourself. Remember *V3 additions not yet in the script*: several v3 rules are not yet
   checked by the script. Check them by hand until the script is updated.

10. Never put a secret, token, or key in a doc or an example. Use `<redacted>` /
    `example.invalid`.
```

---

## 14. Adapting this playbook per repo

The rules are the same everywhere; the examples and the triggers are not. When
adopting it in a repo, change exactly these things and nothing else without a
reason:

- **Triggers and caps.** Starting values: split trigger **~800 lines**,
  `AGENTS.md` cap **200 lines**. A small repo (Coven, My Memory) may split
  earlier; a large one (CASANOS) later. Record the repo's numbers in its own
  `ARCHITECTURE.md` header.
- **Collapse clause.** A small repo may collapse layers into fewer files:

  ```text
  README.md
  AGENTS.md
  ARCHITECTURE.md          # logical + component + runtime + operations, index into as-built files below
  docs/INPUTS.md           # evidence register + items
  docs/REQUIREMENTS.md     # BRD + REQ
  docs/DATA.md             # as-built data, collapsed from docs/as-built/DATA.md
  docs/DESIGN.md           # as-built UI and UX, collapsed from docs/as-built/DESIGN.md
  docs/VERIFICATION.md     # traceability + latest test run
  docs/adr/
  docs/rfc/NNN-*.md
  contracts/
  ```

  **The invariant is one source of truth per fact, not a file count.**
  Collapsing files is allowed; collapsing the SSOT rule is not. A collapsed
  `docs/DATA.md` still carries the ERD, the index matrix, and the lineage;
  a collapsed `docs/DESIGN.md` still carries the five-state matrix. If a
  layer is collapsed away entirely, say so and say where its content went.
- **Migration note.** Repos already using a root `ARCHITECTURE.md` keep it
  as the index; do not move the file just to match the folder. A repo
  adopting `docs/as-built/` for the first time moves `DATA.md`,
  `DESIGN.md`, `VERIFICATION.md`, and the specs into the zone in one PR,
  updates the root index links in the same PR, and records the move in
  that PR's description. A half-moved repo, with specs in two places, is
  worse than a repo that has not moved at all.
- **Examples.** Replace the template examples with the repo's own decisions
  (CASANOS: GW12 token budget as a guardrail row; Mosaic: golden record as a
  contract; Coven: guard dispose as a failure-mode row; AccessBell: the
  copy single source as the `DESIGN.md` example; Coven: pumpkin-orange and
  violet as the token example).
- **File names.** `docs/rfc/` vs CSD files, `docs/as-built/specs/` vs a
  repo's existing spec folder — keep whatever the repo already uses, do not
  rename for the playbook's sake. The one exception is the as-built zone
  itself: if a repo adopts the zone, its as-built files use the names in
  *The as-built zone*, so an agent can find them without reading the repo's history.
- **Ownership.** Name the human owner of each permanent doc. **An unowned doc is
  an unwritten doc.**

### Adoption checklist

- [ ] Set the header: owner, last verified, HEAD, split trigger, AGENTS cap.
- [ ] Write `AGENTS.md` first — precedence, exclusions, commands.
- [ ] Port the consistency checker; wire it into CI.
- [ ] Register existing customer evidence as `IN-xxx` before writing requirements.
- [ ] Crystallize one existing doc as a pilot, with the parity check.
- [ ] Fill the gaps the pilot exposes (typically: system context, verification).
- [ ] Adopt the as-built zone in one PR, or record the decision not to adopt it.
- [ ] Fill `DATA.md` and `DESIGN.md` from the shipped code, not from memory.

---

## 15. What this playbook deliberately does not do

- It does not prescribe a docs site, a generator, or a theme. Content first;
  publishing is a separate decision.
- It does not replace code review. A doc can be perfectly formatted and still
  wrong; only reading it against the code catches that.
- It does not set the split trigger or the `AGENTS.md` cap as law. They are
  defaults with a reason, stated next to them, so a repo can change them
  deliberately instead of drifting.
- It does not claim that a passing consistency check means a correct design.
  See the honest split.
- It does not turn customer statements into requirements. A claim becomes a
  requirement only when an owner writes it with measurable acceptance.
- It does not claim the checker script enforces v3. Section 12.2 lists the
  v3 checks that are not yet implemented. A playbook that claims a check it
  does not have is the exact false confidence this playbook exists to prevent.
