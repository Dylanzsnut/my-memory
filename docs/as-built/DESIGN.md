# My Memory — UI/UX & Interaction Design (As-Built)

- Owner: Duy · Last verified: 2026-11-18 · Against HEAD: `d7aa8d2`
- Copy / i18n single source: `src/lib/i18n.ts`
- Visual tokens: `docs/as-built/design-system.md`
- Historical interaction spec: `docs/rfc/002-ux-interaction-loops.md`

## 1. Surfaces & viewport modes

| ID | Name | Route / trigger | Target viewport | Input |
|---|---|---|---|---|
| UI-001 | Onboarding | first run | mobile PWA, max-w-lg | touch |
| UI-002 | Memories | tab `memories` | mobile PWA | file input, mic, textarea, group chips, group edit controls |
| UI-003 | Ask | tab `ask` | mobile PWA | text input, example chips, live tag chips, tag-scope control |
| UI-004 | Forget | tab `forget` | mobile PWA | touch decisions |
| UI-005 | Memory detail sheet | tap a capture | overlay sheet | touch |
| UI-006 | HUD | in every tab, collapsible | mobile PWA | read-only |
| UI-007 | Toast | after trashing/restoring | fixed bottom | undo / dismiss |

## 2. Interaction state matrix

| Surface | Empty / seed | Loading | Live | Degraded | Error |
|---|---|---|---|---|---|
| UI-001 | three explanatory steps | model probe text | progress state | banner when Nano unavailable | plain-language model error |
| UI-002 | demo seed banner when enabled | `busy` disables capture controls | feed updates on save | SIMULATED badge | capture stays unextracted with HUD error |
| UI-003 | prompt + tag chips from real tags | `busy` disables submit | answer + evidence cards with `#tags` | cloud unavailable → local fallback labelled SIMULATED; active `#tag` scopes retrieval | "Not found in memory" |
| UI-004 | "Nothing to forget right now" | n/a | proposal cards | protected badge | n/a |
| UI-005 | n/a | n/a | extracted facts + original | n/a | n/a |
| UI-006 | `—` | n/a | latency + source counters | SIMULATED counter shown separately | shows error detail |
| UI-007 | n/a | n/a | auto-dismiss planned | n/a | n/a |

The selected tag is shared state in `App.tsx`: choosing `#tag` in UI-002 filters
the memory list, and switching to UI-003 keeps that scope — Ask shows a
"Scoped to #tag" banner and grounds the answer only in captures carrying that
tag. Evidence cards in UI-003 render the cited capture's tags; tapping one
returns to UI-002 with that tag selected. Example chips remain as a secondary
row; real tag chips come from non-trashed captures.

UI-002 primary axis is now local-only **embedding groups** (`ENT-005`): each
group header renders with a folder icon, plain folder name (no `#` prefix — `#`
is reserved for user `tags`), an Auto/Custom badge, and a single `⋮` menu
(Rename / Split… / Delete group — keeps captures). Each capture card also uses
a single `⋮` menu for Move to group… and Move to Trash. Split mode places
checkboxes directly on the real cards with an inline bar (`{n} selected` + new
group name + Create/Cancel). Date filter chips (`All dates / Today / Yesterday /
Older`) and tag filter chips share one horizontal strip, and suggested tag
proposals collapse into a single pill (`{n} suggested tags · Review`) that opens
a review sheet. Captures outside all groups appear under "Ungrouped". Deleting
a group never deletes its captures (Verified: unit tests in `tests/core.test.ts`).
Auto re-clustering skips manual groups and captures with `manualGroupLock`, so
user edits survive recompute.

UI-002 and UI-005 expose a single safe delete action (**Move to Trash** —
30-day recovery + 5s undo toast); permanent deletion lives exclusively in the
dedicated `Trash` screen (`REQ-005`).

Auto-dismiss for UI-007 is a known limit at HEAD; see `Known Limits` below.

## 3. Human-in-the-loop gates & copy rules

- Forget decisions use two deliberate actions: `Keep` and `Move to trash`.
- Protected captures are shown with an explicit "Protected" badge and are never
  auto-proposed.
- Answer copy must not present `SIMULATED` as a real model run.
- UI labels and translations live only in `src/lib/i18n.ts`.
- Seeded captures carry a visible `Demo data` label.

## 4. Visual tokens & accessibility guardrails

Tokens are defined in `docs/as-built/design-system.md`: warm archival cream
canvas, terracotta primary, forest teal badges, charcoal ink, serif headlines
and geometric body text. Status is never encoded by color alone; badges include
text labels.

Known Limits (2026-11-18, owner Duy):

- `aria-label` coverage and 44px touch targets are not audited.
- The undo toast does not auto-dismiss yet.
- The detail sheet has audio playback but no keyboard-only walkthrough test.
