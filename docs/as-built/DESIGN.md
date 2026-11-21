# My Memory — UI/UX & Interaction Design (As-Built)

- Owner: Duy · Last verified: 2026-11-21 · Against HEAD: `757b795` plus the
  uncommitted 2026-11-21 desktop-prototype implementation
- Copy / i18n single source: `src/lib/i18n.ts`
- Visual tokens: `docs/as-built/design-system.md`
- Historical interaction spec: `docs/rfc/002-ux-interaction-loops.md`

## 1. Surfaces & viewport modes

| ID | Name | Route / trigger | Target viewport | Input |
|---|---|---|---|---|
| UI-001 | Onboarding | first run | responsive: mobile first, centred card on desktop | touch |
| UI-002 | Memories | tab `memories` | mobile < 768; top bar + cards >= 768; inspector column >= 1280 | file input, mic, textarea, filter chips, card menus, inspector |
| UI-003 | Ask | tab `ask` | centred reading column; proof panel >= 1280 | text input, example chips, live tag chips, tag-scope control, recent questions |
| UI-004 | Forget | tab `forget` | two-column proposals >= 1024; rules rail >= 1280 | touch decisions, restore from rail |
| UI-005 | Memory detail sheet | tap a capture | bottom sheet < 768, right drawer 768–1023, centred window >= 1024 | touch, arrow keys >= 1024 |
| UI-006 | HUD | in every tab, collapsible | responsive, aligned with content width | read-only |
| UI-007 | Toast | after trashing/restoring | fixed bottom (above safe area) | undo / dismiss |

### Responsive layout (2026-11-21)

Below 768px the layout is unchanged: bottom tabs, one column, bottom sheet and
toast above the safe-area inset. From `md` a sticky left side menu (`SideNav`)
replaces the bottom tabs, the container widens to `max-w-7xl`, and the detail
sheet becomes a full-height right panel with a slide-in animation. From `lg`
Memories uses a sticky control column plus a scrollable capture list; capture,
evidence, proposal and trash cards use a two-column grid. Ask centres at
`max-w-2xl` for comfortable reading. All motion honours
`prefers-reduced-motion`, and custom animations are Tailwind utilities so
responsive variants can override them.

### Desktop workspace v2 — full width, no date dividers (2026-11-21)

Following owner feedback that filters covered half the screen and date
dividers made a long-term memory scroll forever:
- The shell is full width (`md:max-w-none`); card grids use
  `repeat(auto-fill, minmax(17.5rem, 1fr))`, so columns are added as the window
  widens. Ask / Forget / Trash also drop their narrower caps.
- **No day dividers anywhere.** The Memories default view is a flat, newest-first
  grid loaded 60 at a time with "Show more". The date filter offers
  Any time / This week / This month / This year / Older.
- The compact sticky filter bar holds type, date, tag picker, Group-by-tag and
  a suggestions / trash badge; an active-filter summary row appears when a
  filter is on.
- The landing view is **Overview**: a Recent row (~8) plus one tile per tag
  (cover, count, last updated) and an Untagged tile. Clicking a tag opens a
  collection grid.
- Capture cards are Keep-style: image/illustration on top, title, two lines of
  text, tags and date; actions appear on hover/focus and stay visible on touch.
- The right-hand preview panel is now opt-in (off by default); clicking a card
  opens the centred detail window instead. Pinning and a month jump menu are
  out of scope.

### Desktop workspace (2026-11-21, superseded in part by v2 above)

The four prototypes in `docs/prototypes/` supply the visual direction: a sticky
top bar with Ctrl/⌘+K search and quick capture, type and date filters above the
timeline, day dividers, and a right-hand capture inspector at `xl`. Selecting a
card at `xl` updates the inspector; below `xl` it opens UI-005. The inspector's
"Expand space" action opens UI-005 as a centred window with previous/next over
the same ordered list. The Ask tab gains a proof panel built from the top cited
capture and a local, clearable recent-questions list. Forget gains a four-stat
row, side-by-side comparison when a proposal has a related capture, a truthful
rules rail, and restore shortcuts for recent trash items.

### Preview, tag approval and Ask suggestions (2026-11-21)

- The preview panel now falls back to the newest memory and works in Overview;
  the two-column layout is applied only when the panel actually has a capture,
  so there is no empty reserved column. The toggle is available at `xl` only.
- Tag approval locks only real-looking secrets (keyword-adjacent values,
  4–8 digit codes, letter+digit/symbol mixes). Category words such as `#wifi`,
  `#password` and `#mat khau` are addable; `#songhong2024` and `#849201` stay
  locked with a visible reason line. The answer check and cloud redaction are
  unchanged and remain strict.
- **Dated amendment (2026-11-21):** the earlier note that "example chips remain
  in Ask" is superseded. Ask suggestions come from `suggestQuestions`, which
  builds at most 5 deduped questions from the user's own captures (expiry,
  amount, password note, voice and recent items, plus tag totals only when
  online). Demo mode uses the same generator on its local sample data; no fixed
  question text remains. An empty library shows a "save something first" hint.
  The detail view and inspector use the same generator on a single capture.

### Plain-language copy & technical-details toggle (2026-11-21)

Following an owner report that the desktop UI read like a developer tool, all
user-facing copy is plain language in EN/VI. The greeting uses a person's first
name only for Google accounts (Demo mode has no name), and the big heading is
"Your memories" rather than repeating the filter chip. Captures are introduced
as "Saved photo" / "Saved voice" / "Saved note" rather than by an ID suffix.

A local `technicalDetails` user meta setting, off by default, is toggled in the
account menu. With it on: the telemetry HUD, match scores, response times,
account uid, storage estimate, raw source labels ("On device" / "In cloud" /
"Local lookup") and memory IDs appear. With it off, answers still state plainly
whether they were answered on this device or with cloud help, and "Not found"
stays explicit. The browser-wide storage figure is never shown as a memory
count, since it covers all site storage.

Prototype elements that are deliberately not implemented: GPS/camera EXIF
fields, an Ask microphone, invented confidence or neural-index badges,
encrypted-trash wording, bulk Empty Trash, invented structured fields,
detection boxes, sharpness labels, Settings/Restore History/Session ID,
sensitivity sliders, annotation/bookmark, invented card badges, the Archive
breadcrumb, remote fonts and the Material Symbols icon font. Each would either
invent data, add an unapproved feature, or break the offline/privacy rules.

## 2. Interaction state matrix

| Surface | Empty / seed | Loading | Live | Degraded | Error |
|---|---|---|---|---|---|
| UI-001 | three explanatory steps | model probe text | progress state | banner when Nano unavailable | plain-language model error |
| UI-002 | demo seed banner when enabled | `busy` disables capture controls | feed updates on save | SIMULATED badge | capture stays unextracted with HUD error |
| UI-003 | prompt + tag chips from real tags (demo chips only in Demo mode / no tags) | `busy` disables submit | answer + evidence cards with `#tags`; answer scrolls into view | cloud unavailable → local fallback labelled SIMULATED; active `#tag` scopes retrieval | neutral/gold "Not found in memory" panel with next steps (try `#tag`, check spelling) |
| UI-004 | "Nothing to forget right now" | n/a | proposal cards | protected badge | n/a |
| UI-005 | n/a | n/a | extracted facts + original; detected entities can be approved as tags | sensitive / unusable entities shown disabled | n/a |
| UI-006 | `—` | n/a | latency + source counters | SIMULATED counter shown separately | shows error detail |
| UI-007 | n/a | n/a | announced via `role="status"`; auto-dismisses after 5s with optional Undo | n/a | n/a |

UI-002 capture cards are scannable: the card body opens UI-005 and the only
action is a single `⋮` menu containing **Move to Trash**. Summaries wrap to two
lines. The header shows a time-aware greeting, "All memories", the capture
count, and one live `navigator.onLine` pill (*Online · local-first* /
*Offline · local mode active*); offline changes both the dot and the pill
surface. New accounts see a welcoming empty state; when a date/tag filter
matches nothing, a one-tap "Clear filters" button appears. Date chips
(`All dates / Today / Yesterday / Older`) use calendar days in local time, not
rolling 24-hour windows. In-flight work is visible: an extracting banner in
UI-002 and a shimmer "Searching your memory…" card in UI-003. UI-005 opens the
original photo in a full-screen lightbox for reading fine print.

The selected tag is shared state in `App.tsx`: choosing `#tag` in UI-002 filters
the memory list, and switching to UI-003 keeps that scope — Ask shows a
"Scoped to #tag" banner and grounds the answer only in captures carrying that
tag. Evidence cards in UI-003 render the cited capture's tags; tapping one
returns to UI-002 with that tag selected. Real tag chips come from non-trashed
captures; the demo example questions appear only in Demo mode or when no tags
exist, and both chip rows collapse after a question so the answer stays above
the fold.

UI-002's primary axis is local-only **tags** (`#label`) plus a "Group by tag"
view: each capture appears once under its first tag, with an "Untagged" section
where needed. Date filters and tag filters now occupy **two separate rows** so
the rightmost tag can never be hidden in a single scrolling strip. The shared
`TagFilterBar` keeps All and Untagged visible, sorts tags by capture count
(alphabetical tie-break), pins the selected tag into the visible set, and
collapses long lists behind "+N more" with a wrapped, searchable expanded list.
It is also used in UI-003 so both tabs show the same tags and counts. Suggested
tag proposals collapse into a single pill (`{n} suggested tags · Review`) that
opens a review sheet with per-member checkboxes, Accept, Rename and Dismiss.
Accept writes the label as a real tag on the selected captures; rename overrides
and dismissals persist per user, so they survive recompute. Tag edits are scoped
to the capture being edited and never touch other captures (Verified: unit tests
in `tests/core.test.ts`).

UI-005 shows every auto-extracted entity as a chip. Tapping a chip promotes it
to a real `#tag` on that capture only (`prepareEntityTag`); already-approved
entities show a ✓, while sensitive entities (passwords, OTPs, codes) and labels
that cannot make useful tags are disabled with an explanatory title. The same
cleanup and duplicate checks are used by the manual add-tag box. This is an
approval path for existing index data — it introduces no new inference or cloud
call, and no new data in Firestore writes.

UI-002 and UI-005 expose a single safe delete action (**Move to Trash** —
30-day recovery + 5s undo toast); permanent deletion lives exclusively in the
dedicated `Trash` screen (`REQ-005`).

### Keyboard & accessibility (2026-11-20)

- All modal surfaces (suggestions review, trash confirm, UI-005 detail sheet
  and its photo lightbox) close on Escape and backdrop click, trap Tab focus,
  restore focus to the trigger, and lock page scrolling while open. Nested
  lightbox Escape is consumed by the lightbox first. The account menu is a
  non-modal popover with Escape / outside-click dismissal.
- The review sheet, delete confirms and UI-005 handle `aria-modal`, `aria-label`
  and `aria-expanded`; toasts use `role="status"` with `aria-live="polite"`.
- All reviewed controls have 44px minimum touch targets; text inputs use 16px
  to prevent iOS focus zoom; labels are at least 11px, and `ink3`/`gold` tokens
  meet 4.5:1 on their surfaces.

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

Known Limits (2026-11-20, owner Duy):

- Contrast ratios and touch targets were fixed and checked by calculation, but
  there has been no automated axe audit or screen-reader walkthrough on a real
  device — visual and AT behaviour remains a manual check.
- The detail sheet has audio playback but no keyboard-only walkthrough test.
- Physical Chrome 139+ Nano 4 / Console behaviour remains an external check (no
  device-integration code changed in this review).
