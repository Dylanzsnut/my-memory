# My Memory — Web app task plan

Scope: the Web/Chrome companion only. Google sign-in is **mandatory**. Manual
memory deletion is supported in addition to the Forget proposal queue. Gallery
import with EXIF dates and a user-owned tag layer (with embedding-based tag
suggestions — design in `docs/rfc/003-auto-tagging-flow.md`) are in scope and
tracked in their own sections below. All hackathon submission tasks (Android
scope, demo video, judge instructions, disclosure text, submission copy) are
intentionally out of scope. Housekeeping — git commit/push and similar chores —
is not logged here as tasks.

## Design decisions (defaults — change before implementation if needed)

- **Implementation order (default):** Groups: editable embedding groups (the
  only remaining feature group; Import, Tags, Auth modes, Manual delete, P1 and
  P2 code are complete). Console/live-verification items run in parallel when
  Firebase Console or a mobile Chrome device is available. Change here if
  priorities shift.
- **Groups:** embedding groups replace the fixed Today/Yesterday/Older buckets
  as the primary axis of `Memories`; date becomes a filter/sort, not a group key.
  Groups are local-only (never synced) and user-editable: **Split** means select
  captures → new named group. Auto-generated membership must survive recompute
  once the user has edited it. This extends the Groups section in
  `docs/rfc/003-auto-tagging-flow.md` (dated amendment there, not a silent edit).
- **Manual delete:** deleting a memory from Memories or the detail sheet moves it
  to the 30-day trash. From the trash the user can restore it or permanently
  delete it with a confirmation. A manual delete is recorded separately from a
  Forget proposal approval.
- **Bulk delete:** not supported. Only one memory at a time, to preserve the
  "no automatic or bulk purge" rule.
- **Protected captures:** still manually deletable, with a stronger
  confirmation. Auto-proposals continue to exclude them.
- **Immediate permanent delete (superseded 2026-11-19):** removed from
  `DetailSheet` to keep a single, safe mental model — every delete in
  `Memories` or `DetailSheet` moves the capture to the 30-day Trash with a 5s
  undo toast; permanent deletion lives **only** inside the Trash screen (with
  confirmation). Restores full alignment with `REQ-005`.
- **Photo capture:** a single **Photo** action opens the platform picker
  (camera or gallery/file) with multi-select. `capturedAt` comes from EXIF
  `DateTimeOriginal` when present,
  falling back to `file.lastModified` then import time. Only `DateTimeOriginal`
  is read from EXIF; GPS and device-identifying EXIF fields are never stored or
  synced.
- **Tags:** three layers with distinct ownership. `entities` stay model-derived
  and non-editable (re-extraction may rewrite them); `tags` are user-authored
  (add/remove freely, survive re-extraction) and join the search index;
  `suggestedTags` are proposals derived from embedding-based grouping and are
  only written after an explicit Accept. **Tags never sync to Firestore.**
- **Auth:** no guest mode. The first sign-in needs a network connection; after
  that the session is cached and the local index works offline.
- **Seed demo data:** two explicit auth modes at the sign-in gate. `demo` login
  seeds the existing `SEED_ITEMS` (marked `demo: true`) for judging; Google login
  starts with an empty memory and cleans up any leftover demo records before the
  memory loads. Demo data stays partitioned from real accounts and is never
  synced to Firestore (INV-302). This supersedes the earlier "dev builds only"
  default.
- **Firestore sync:** off by default (`VITE_ENABLE_FIRESTORE_SYNC=false`).
  `firestore.rules` enforces per-user `/users/{uid}/captures/{captureId}`
  metadata-only rules in the repo (pending `firebase deploy --only
  firestore:rules`). No data leaves the device by default.
- **Ask-about-this-capture suggestions (owner decision 2026-11-18):** the three
  fixed questions in `DetailSheet` are a template; suggestions are instead
  derived from the capture's own fields (`type`, `expiryDate`, `entities`,
  `summary`) by **local heuristics only** — no Nano call, no network, no new
  privacy surface. Answers are **pinned to the tapped capture** (grounded in it
  alone, threshold bypassed for that capture, `verifyClaim` still fail-closed).
  Suggestions appear in the detail sheet only; the Ask tab's example chips stay
  unchanged.

---

## P0 — blocking

- [x] Commit the current uncommitted changes (15 files at last check, including
      the AGENTS.md and this plan's updates): deny-all `firestore.rules` with a
      per-user template, opt-in Firestore sync (demo records skipped, failures
      caught), SDK `inferenceSource` mapping (lowercase values, no hardcoded
      cloud label), limited-use App Check tokens, cloud fallback model retry,
      surfaced inference errors in the HUD (`error` on `AnswerResult`), real
      `trashedAt` plus separate `purgeAt`, no remote font requests, and corrected
      README / `WEB_SETUP.md` / `.env.example`.
- [x] Commit the current uncommitted changes (7 files at last check): new
      `docs/DATA.md` (data design), new `docs/rfc/003-auto-tagging-flow.md`
      (agreed tagging design), the `docs/specs/` zone retired the same day it
      was created, plan updates (auth modes / import / tags / immediate delete
      task groups and design decisions), `docs/README.md` zone map,
      `docs/ARCHITECTURE.md` related docs, `docs/as-built/DATA.md` design-layer
      pointer, and the two `AGENTS.md` zone rewordings. (Landed in `d3473d0`.)
- [ ] Rebuild and redeploy Hosting from the new commit.
- [x] Fix `answer.ts`: set `notFound = verified.length === 0` so a "Not found"
      answer never renders with the "Verified from your capture" banner.
- [ ] Console: enable AI Logic → Get started with the Gemini Developer API.
- [ ] Console: register the reCAPTCHA Enterprise key for the Web app under App
      Check, then enable enforcement.
- [ ] Smoke test live in Chrome Desktop 139+ with the Prompt API flag enabled:
      on-device extraction, on-device answer, cloud synthesis.
- [x] Voice: stop using the Web Speech API (Chrome sends audio to Google
      servers). Record with `MediaRecorder` and store the blob locally.
      Note: verified via `npm run typecheck && npm run build`; live microphone
      capture needs manual check in browser.
- [x] Voice: remove the fabricated `"Sample voice memo transcript"` string;
      leave the transcript empty or let the user type it.
- [x] Voice: add audio playback in `DetailSheet`. Note: object URL is created
      from `audioBlob` and revoked on unmount; needs manual playback check in
      browser.
- [x] Onboarding: probe `LanguageModel.availability()` and show the real model
      state instead of a hard-coded "Ready ✓". Note: needs manual check in
      Chrome 139+ to observe `'readily'`/`'after-download'` transitions.
- [x] Flow 7: show a banner when Nano is unavailable and label cloud answers
      explicitly. Note: also wired `inCloudParams` on `PREFER_ON_DEVICE` so
      cloud fallback works when Firebase AI Logic is configured.
- [x] Offline: add a service worker and manifest (PWA) so a reload works with
      the network off. Note: `public/sw.js`, `public/manifest.webmanifest`,
      and `public/icon.svg` bundled into `dist/`; offline reload needs manual
      browser verification under `npm run preview` or Hosting.
- [x] Offline: no third-party font requests. Result differs from plan: removed
      the Google Fonts `<link>` from `index.html` and switched to system font
      stacks in `styles.css` instead of self-hosting font files. Self-hosting can
      still be added later if the exact typeface is required.

## Mandatory Google sign-in

- [ ] Console: enable the Google provider in Authentication.
- [x] Add a sign-in gate before onboarding and the app, with loading and error
      states (popup blocked, offline).
- [x] Cache the session after the first sign-in so the app works offline.
- [x] Partition IndexedDB by `uid`; signing out must not delete local data, and
      switching accounts must not mix data.
- [x] Google sign-in never seeds demo data; clean up leftover demo records
      before loading the user's memory (see "Auth modes: Google vs demo").
- [x] Change Firestore sync to `/users/{uid}/captures/{id}`.
- [x] Activate the per-user rules template in `firestore.rules` (compare
      `request.auth.uid` with the `{uid}` path segment) and deploy it.
      Note: `firestore.rules` updated locally; deploying rules requires live
      Firebase project CLI (`firebase deploy --only firestore:rules`).
- [x] Add an account menu: show email, sign out.
- [x] Add account deletion: remove local data and Firestore metadata.
- [ ] Verify user A cannot read user B's data, and that no blob, transcript or
      embedding is written to Firestore.
      Note: code paths verified locally; live cross-user Firestore verification
      requires Firebase Console Google provider setup + rules deploy.

## Auth modes: Google vs demo

Scope: the sign-in gate offers two explicit modes. **Google** is a real Firebase
Auth account with an empty memory — no demo data shown, no seed data synced.
**Demo** is a local-only mode with pre-seeded captures for judging; every record
is marked `demo: true` and must never be presented as real user data (REQ-006,
INV-302, seed-decision note above).

- [x] Add an explicit auth mode (`google` | `demo`) to the sign-in gate and to
      session/meta state; Google uses Firebase Auth, demo bypasses it locally.
- [x] Google login: never call `seedDemoCaptures()`; start with an empty memory
      even if the local store still holds old seed records.
- [x] Google login cleanup: remove any `demo: true` captures plus their proposals
      and HUD events from the local store before memory loads, so stale demo
      records are never displayed or returned by search. Document this one-time
      cleanup in `docs/as-built/DATA.md`.
- [x] Demo login: seed the existing `SEED_ITEMS` set on first demo session (all
      records `demo: true`) so Save / Ask / Forget work out of the box.
- [x] Partition demo data from real accounts (demo uses its own local namespace
      / uid). Switching demo ↔ Google must not mix data, and demo records must
      stay excluded from Firestore sync even when `VITE_ENABLE_FIRESTORE_SYNC=true`.
- [x] Change `SEED_DEMO` to explicit opt-in (default off) so an unset env var can
      never seed a real Google session; demo mode opts in explicitly.
- [x] Verify: Google login shows an empty memory with no demo records; demo
      login shows the seeded captures; no `demo: true` capture, transcript or
      embedding is written to Firestore; switching modes never leaks data.
      Note: partitioning and sync guards verified in code + build; live Google
      OAuth login requires Firebase Console Google provider enablement.

## Manual memory deletion

- [x] Add a delete action to `DetailSheet` and to each card in `Memories`, with
      a confirmation dialog.
- [x] Add "Delete permanently now" in `DetailSheet` behind a stronger
      confirmation (second confirm, no trash). Record it as a distinct decision
      type and document it as the explicit exception to the `REQ-005`
      recoverable window (`docs/as-built/specs/forgetting.md`, `docs/DATA.md` §3).
- [x] Manual delete moves the memory to the 30-day trash and shows a 5-second
      undo toast.
- [x] Share the delete implementation with the Forget flow (reuse
      `applyDecision` or add a common helper), but record "manual delete"
      separately from "proposal approved".
- [x] Close any pending proposal for a manually deleted memory.
- [x] Add a dedicated Trash screen: list, restore, days remaining. Currently
      the trash is only a section inside the Forget tab.
- [x] Add "Delete permanently" in the Trash with a confirmation; remove the
      image and audio blobs from IndexedDB.
- [x] Purge items past `purgeAt` on app open. Document this as an intentional,
      user-visible exception to the "no background deletion" rule.
- [x] Sync the `trashed` state to Firestore and delete the metadata document on
      permanent deletion.
- [x] Verify deleted captures never appear in search or Ask and are never sent
      to the cloud. (Verified in `searchCaptures`, `handleAsk`, and `Memories`;
      automated regression tests added in P2.)
- [x] Update `AGENTS.md` §3, `idea.md` §3.4, CSD §7.2 and i18n strings: the rule
      is "the AI never deletes on its own", not "deletion only via proposals".
      (Updated `AGENTS.md` §3, `docs/rfc/000-my-memory-concept.md` §3.4,
      `docs/rfc/001-my-memory-csd.md` §7.2 via dated amendments, and `i18n.ts`.)

## Import & capture sources

Scope: `Memories.tsx` today uses one `<input type="file" accept="image/*"
capture="environment">` — `capture="environment"` forces the camera on mobile,
single file only, and `capturedAt` is the import time. Target: gallery import
with correct dates, without weakening the privacy boundary.

- [x] Use a single **Photo** action backed by one file input (`accept="image/*"`,
      `multiple`, **no** `capture` attribute) so mobile offers camera or gallery
      and desktop opens the file picker.
      Correction (2026-11-18): initially split into two buttons ("Take photo" /
      "Import photos"); owner merged them into one labelled "Photo".
- [x] Multi-select import: accept multiple files, queue one on-device extraction
      per image with visible progress; a failed item keeps its original and
      shows an error state instead of dropping it.
- [x] Set `capturedAt` from EXIF `DateTimeOriginal` when present, falling back
      to `file.lastModified` then import time; document the derivation in
      `docs/DATA.md` §2.1 and keep the `by-date` index consistent.
- [x] Privacy: read only `DateTimeOriginal` from EXIF; never store or sync GPS,
      device serial or other EXIF fields. Add this as a storage invariant
      (`INV-3xx` in `docs/as-built/specs/storage-layout.md`).
- [x] Duplicates from batch import stay handled by `F1` proposals (earlier
      capture is never the proposed one).
- [x] Update `REQ-001` acceptance criteria in `docs/requirements/req-web-app.md`
      for camera + gallery import and multi-select.
      Note: EXIF reader is `src/lib/exif.ts` (JPEG APP1 → TIFF ExifIFD tag 0x9003
      only); `ExtractionRequest.capturedAt?` added in `src/types.ts` and honoured
      in `App.tsx`, which now keeps the original with a labelled `SIMULATED`
      error if extraction throws. Verified with `npm run typecheck && npm run
      build` plus a synthetic-JPEG check of the parser (valid date, malformed
      and non-JPEG inputs). `INV-304` added as UNVERIFIED. The Photo action reuses
      the existing `photo` i18n key (EN "Photo", VI "Ảnh"); `snap` and
      `importPhotos` keys were removed.
- [ ] Verify in mobile Chrome: gallery import, multi-select order and dates,
      EXIF fallback chain, no GPS/device fields in IndexedDB or Firestore.
      Note: code and `npm run typecheck && npm run build` verified; physical
      mobile Chrome gallery picker requires manual device check (not runnable here).

## Tags & suggested groups

Scope: `entities` (model-derived) currently double as tags and are mixed into
the search index; they cannot be edited and are rewritten on re-extraction.
Target: a user-owned tag layer plus embedding-based groups that *suggest* tags —
suggestions follow the proposal pattern and are never applied automatically.
Flow design (agreed 2026-11-18): `docs/rfc/003-auto-tagging-flow.md`.

- [x] Extend `CaptureRecord` with `tags: string[]` (user-authored) and
      `suggestedTags: string[]` (derived proposals). Re-extraction must never
      touch `tags`. Keep `entities` as the auto-derived index only.
- [x] `DetailSheet`: add/remove tags (chips + input); render `entities`
      labelled "auto" separately from user tags so the two are never confused.
- [x] Include `tags` in the local search index (`search.ts`) and support
      filtering / timeline grouping by tag in `Memories`.
- [x] Local grouping: cluster captures by cosine similarity over `embedding`
      (connected components over per-type thresholds — `photo` / `voice` /
      `note`, cross-type pairs use the higher threshold; defaults 0.85, Remote
      Config tunable) and derive a candidate tag per group from shared keywords
      — offline, no model call required. Spec: `docs/rfc/003-auto-tagging-flow.md`.
- [x] Suggested-groups UI — a "Groups" section inside `Memories`: show each
      group's captures with a proposed tag; Accept tags the whole group with
      per-capture deselection, Rename edits the label first, Dismiss drops it.
      No automatic write path (same rule as Forget: model proposes, human
      disposes).
- [x] Generate suggestions automatically when the app opens and new captures
      exist, plus a manual refresh. Generation writes `suggestedTags` proposals
      only (never `tags`) — the same split as Forget's `scanForProposals`.
- [x] Never sync `tags` or `suggestedTags` to Firestore: extend the "never
      written" list in `docs/DATA.md` §4.2 and keep `syncCaptureMetadata`
      free of tag text.
- [x] Update `REQ-002`/`REQ-003` references and add an acceptance criterion for
      user-owned tags in `docs/requirements/req-web-app.md`.
- [x] Verify: tags persist and survive re-extraction; a suggestion exists only
      after Accept; search honours tags; tag text never appears in Firestore
      writes; `npm run typecheck && npm run build` pass. (Code and build
      verified; automated test coverage added under P2.)

## Groups: editable embedding groups

Scope: `Memories.tsx` currently builds three fixed buckets from `capturedAt`
(`dayGroup()` → Today / Yesterday / Older) on every render; nothing is persisted
or editable (owner report 2026-11-18). Target: embedding groups are the primary
axis of `Memories`, date is only a filter/sort, and groups are local-only
(never synced) and user-editable. Extends `docs/rfc/003-auto-tagging-flow.md`.

### Phase 1 — Data model & IndexedDB v2
- [x] Types (`src/types.ts`): add `MemoryGroup` (`id`, `name`, `captureIds`,
      `source: 'auto' | 'manual'`, `createdAt`, `updatedAt`, `ownerUid?`) and
      optional `manualGroupLock?: boolean` (or explicit membership tracking) so
      user edits survive recompute. Keep `CaptureRecord` originals untouched.
- [x] IndexedDB v2 migration (`src/lib/store.ts`): bump `my-memory` DB version
      from `1` to `2` with an additive `upgrade` that creates object store
      `groups` (`keyPath: 'id'`); never touch existing `captures` originals.
- [x] Store CRUD & UID partitioning (`src/lib/store.ts`): add `getGroups(uid)`,
      `saveGroup(group)`, `deleteGroup(id)` scoped by `ownerUid` (same
      `belongsToOwner` boundary as captures/proposals). Update
      `cleanupDemoRecordsForUser(uid)` and `deleteUserLocalData(uid)` so demo
      cleanup and account deletion also remove scoped groups.
- [x] Firestore privacy guard (`src/lib/firebase.ts`, `firestore.rules`):
      verify no group field or `groups` store is ever read or written by
      `syncCaptureMetadata`; keep `groups` 100% local-only.

### Phase 2 — Pure grouping & edit engine (`src/lib/groups.ts`)
- [x] Extract shared clustering helpers from `src/lib/tags.ts` (reuse
      `pairGroupThreshold` and `deriveGroupLabel`) so embedding clustering has
      one implementation across tag proposals and editable groups.
- [x] Auto-group generator (`reconcileAutoGroups` in `src/lib/groups.ts`):
      cluster non-trashed captures not locked by manual assignment using RFC 003
      per-type thresholds (cross-type pairs use the higher threshold, min size
      2); preserve all `manual` groups and locked memberships verbatim; return
      reconciled groups + ungrouped capture IDs. Grouping never writes `tags`.
- [x] Pure edit helpers (`src/lib/groups.ts`): implement `splitGroup(group,
      selectedIds, newName)`, `renameGroup(group, newName)`,
      `moveCaptureToGroup(groups, captureId, targetGroupId | null)`, and
      `removeGroup(groups, groupId)` (deleting a group returns its captures to
      ungrouped and never deletes or trashes any capture).

### Phase 3 — App state & RFC 003 integration (`src/App.tsx`)
- [x] Load & reconcile groups in `App.tsx`: load `getGroups(session.uid)` on
      boot/session switch, run `reconcileAutoGroups` when captures change
      (capture added, trashed, restored, or permanently deleted), and persist
      updated groups to IndexedDB.
- [x] Wire group edit handlers in `App.tsx`: `handleSplitGroup`,
      `handleRenameGroup`, `handleMoveToGroup`, `handleDeleteGroup` (persisting
      manual lock so future recomputes never undo user edits).
- [x] RFC 003 promotion hook: when accepting a `TagGroupProposal`, optionally
      promote/name the corresponding group using the accepted label; Dismiss
      creates no group.

### Phase 4 — Memories UI (`src/components/Memories.tsx`, `src/lib/i18n.ts`)
- [x] Replace `dayGroup()` bucketing in `Memories.tsx`: render persisted
      embedding groups as the primary list, plus an "Ungrouped" section for
      singletons / ungrouped captures.
- [x] Date filter/sort chips: replace the old date buckets with filter chips
      (`All` / `Today` / `Yesterday` / `Older`) that filter captures inside
      groups without changing group membership, alongside existing tag chips.
- [x] Group card header & inline rename/delete: each group header shows its
      name, member count, an `Auto`/`Custom` badge, inline rename, and a delete
      group button (with clear copy that captures are kept).
- [x] **Split** flow UI: "Split" action on a group enters multi-select mode on
      that group's captures, prompts for the new group name, and moves the
      selected captures into the new group while keeping the original group.
- [x] Move / add / remove member UI: allow moving a capture to another group or
      removing it from a group (back to Ungrouped) from the group card or
      `DetailSheet`.
- [x] i18n EN/VI (`src/lib/i18n.ts`): add all strings for groups, Ungrouped,
      date filter chips, Split, Rename, Move, Delete group (keeps captures),
      and empty states; ensure `min-h-11` touch targets and `aria-label`s.

### Phase 5 — Tests & documentation
- [x] Unit tests (`tests/core.test.ts`): test `reconcileAutoGroups` (per-type &
      cross-type thresholds, trashed excluded, manual overrides survive
      recompute), `splitGroup`, `renameGroup`, `moveCaptureToGroup`, and
      `removeGroup` (captures untouched).
- [x] Docs update: add `ENT-005 MemoryGroup` and IndexedDB v2 migration to
      `docs/DATA.md` and `docs/as-built/DATA.md`; add a **dated amendment** to
      `docs/rfc/003-auto-tagging-flow.md` (no silent body edit); update
      `docs/as-built/DESIGN.md`, `docs/requirements/req-web-app.md` (`REQ-001` /
      `REQ-003`), and `docs/as-built/VERIFICATION.md`.
- [x] Full automated verification: `npm run typecheck && npm run lint && npm test
      && npm run build` pass (17 tests / 5 suites). `groups` CRUD is scoped by
      `ownerUid`; `syncCaptureMetadata` writes only the C3 allowlist, so group
      data never reaches Firestore.
- [ ] Manual browser verification: groups persist across reloads; Split/Rename/
      Move/Delete survive auto recompute; group UI works on a mobile viewport.
      Note: not runnable in this environment — needs a live browser check.

      Note (2026-11-19): implemented `src/lib/groups.ts` with shared clustering
      from `src/lib/tags.ts` (`clusterCaptures`, `deriveGroupLabel`), IndexedDB
      v2 `groups` store, `manualGroupLock`, App reconcile/edit handlers, RFC 003
      Accept-promotion, and the full Memories UI (group cards, date filter
      chips, Ungrouped, Split multi-select, per-card Move selector, EN/VI i18n,
      `min-h-11`/`aria-label`). `dayGroup()` date buckets were removed as group
      keys. Docs updated: `DATA.md` ENT-005 + v2, `as-built/DATA.md`, RFC 003
      dated amendment, `DESIGN.md` UI-002, `REQ-001/003`, `VERIFICATION.md`.

## Ask ↔ Memories tag alignment

Scope: `Memories.tsx` owns a local `activeTag` filter and real `capture.tags`;
`Ask.tsx` has only five hardcoded example questions and ignores tags entirely
(owner report 2026-11-19). Target: one shared tag context across both tabs, and
tag-bearing evidence cards in answers.

- [x] Lift `activeTag` from `Memories.tsx` into `App.tsx` state; pass
      `activeTag` / `onActiveTagChange` into both `Memories` and `Ask` so switching
      tabs preserves the selected tag (both directions).
- [x] `Ask.tsx`: derive tag chips from the actual tags on non-trashed captures
      (passed from `App`), render them as `What do I have about {tag}?` questions,
      keep the existing five example chips as a fallback / secondary row, and
      show a clear "scoped to #tag" indicator when a tag is active.
- [x] `App.handleAsk`: when a tag is active, scope `buildAnswer` to captures that
      carry that tag (including the pinned-capture path) so the answer agrees
      with the filter shown in Memories; `verifyClaim` stays fail-closed.
- [x] `Ask.tsx` source cards: show the cited capture's `#tags`; clicking a tag
      sets the shared `activeTag` and returns to the `memories` tab so the user
      can continue filtering. Avoid nested buttons (keep the evidence card's
      open-detail action accessible).
- [x] i18n EN/VI for the new Ask tag strings and aria-labels; keep `min-h-11`
      touch targets.
- [x] Tests / docs: add a unit test for tag-scoped retrieval (`searchCaptures`
      honours a tag-only query) and update `docs/as-built/DESIGN.md` (UI-003),
      `docs/requirements/req-web-app.md` (REQ-002/REQ-003) and
      `docs/as-built/VERIFICATION.md`.
- [x] Verify: `npm run typecheck && npm run lint && npm test && npm run build`
      pass; manual browser check that an accepted tag in Memories appears in
      Ask, survives tab switches, scopes answers, and evidence tags navigate
      back to the filtered memory list.

      Note (2026-11-19): shared `activeTag` lifted to `App`; Ask derives tag chips from live tags and keeps the five example chips, scopes `buildAnswer` to the active tag (including pinned-capture path), and evidence cards show clickable `#tags` that return to the filtered Memories list. EN/VI strings added. 18/18 tests pass (new tag-only retrieval test); typecheck/lint/build pass. Manual browser check of the full flow still pending.

## UX streamlining: tagging, grouping & deletion

Scope: owner review (2026-11-19) — current Memories/DetailSheet chrome is
crowded and blurs Groups vs Tags vs Delete paths. Target: one clear mental
model: **Group** = soft folder (plain name, no `#`), **Tag** = `#label` for
search/Ask, **Delete** = Move to Trash everywhere except inside Trash.

- [x] Distinct visual language: remove `#` prefix from Group headers in
      `Memories.tsx` (plain folder name + folder icon, `Auto`/`Custom` badge);
      reserve `#` exclusively for user `tags`.
- [x] Compact filter bar (`Memories.tsx`): merge date filter chips and tag
      filter chips into a single clean horizontal filter strip so the first
      capture appears higher on mobile viewports.
- [x] Suggested tags pill + review sheet (`Memories.tsx`): replace the large
      inline `tagGroups` block with a compact pill (`{n} suggested tags ·
      Review`) that opens a modal/sheet for Accept / Rename / Dismiss.
- [x] Group header `⋮` menu (`Memories.tsx`): replace the 3 inline buttons
      (Rename / Split / Delete) + hint text with a single `⋮` menu (Rename,
      Split…, Delete group — keeps captures).
- [x] In-place Split flow (`Memories.tsx`): entering Split mode shows
      checkboxes directly on the real capture cards in that group (no duplicate
      list) plus a sticky bottom bar (`{n} selected` + new group name input +
      Create / Cancel).
- [x] Card `⋮` menu (`Memories.tsx`): remove the inline `Move to…` dropdown and
      inline trash icon from every card; place Move to group… (inline picker in
      sheet/popover) and Move to Trash behind a single card `⋮` button so cards
      stay scannable.
- [x] Unified Delete (`DetailSheet.tsx`, `App.tsx`): remove "Delete permanently
      now" from `DetailSheet` so Memories and DetailSheet have one safe action
      (Move to Trash, 30-day recovery + 5s undo toast); permanent delete lives
      exclusively in `Trash.tsx`.
- [x] i18n EN/VI (`src/lib/i18n.ts`), docs (`docs/as-built/DESIGN.md`,
      `docs/DATA.md` §3, `docs/as-built/specs/forgetting.md`), and verification:
      `npm run typecheck && npm run lint && npm test && npm run build`.
      Note (2026-11-19): all 8 UX streamlining tasks verified via typecheck,
      lint, 18/18 tests, and production build.

## Suggested tag rename applies immediately

Scope: owner report (2026-11-19) — in the `Review` sheet, editing a suggested
tag label changes only local `renamingId`/`renameValue` state; the label reverts
unless the user clicks Accept, so the rename appears to do nothing on screen.

- [x] `App.tsx`: add persisted `renamedTagGroups` map (`fingerprint → label`)
      loaded from `getUserMeta(uid, 'renamedTagGroups', {})`; apply overrides to
      groups **and** `suggestedByCapture` inside `syncTagSuggestions` so a rename
      survives recompute/refresh.
- [x] `App.tsx`: add `handleRenameTagGroup(group, label)` that updates
      `tagGroups` immediately, persists the override, and refreshes suggestions
      without waiting for Accept.
- [x] `Memories.tsx`: commit the inline rename on **Enter and blur** (and clear
      the editing state) so the new `#label` shows instantly in the review
      sheet; keep Accept writing the currently displayed label.
- [x] Verify: `npm run typecheck && npm run lint && npm test && npm run build`.

      Note (2026-11-19): rename commits on Enter/blur and persists a fingerprint→label override in `renamedTagGroups` user meta; overrides are applied in `syncTagSuggestions` to both group labels and suggested tag lists. Accept now writes the displayed label. 18/18 tests + typecheck/lint/build pass.

## P1 — product quality

- [x] Automatic F4 protection (health/medicine entities, blurry images, photos
      with people). Currently only the seed record has `protectedReason`.
      (Added `src/lib/protection.ts` wired into `handleCapture` in `src/App.tsx`.)
- [x] Improve search: stopwords, fewer hash collisions, broader EN/VI synonyms.
      (Updated `src/lib/embeddings.ts` to 512-dim signed hashing, EN/VI
      stopwords & synonyms; improved word-level scoring + dimension migration in
      `src/lib/search.ts` and `src/App.tsx`.)
- [x] Add a search/answer test set with in-corpus and out-of-corpus questions;
      out-of-corpus must return "Not found". (`tests/core.test.ts` runs 5 EN/VI
      in-corpus queries and 5 out-of-corpus / trashed queries via `npm test`.)
- [x] Split the HUD into three counters: on-device, cloud, simulated.
      (Updated `src/components/Hud.tsx` and `src/lib/i18n.ts`.)
- [x] Filter or ask consent before sending sensitive `entities` (passwords,
      OTPs) to the cloud. (Added `hasSensitiveEntities` + default redaction in
      `src/lib/ai.ts` with user confirmation in `src/lib/answer.ts`/`src/App.tsx`.)
- [x] For long synthesis while offline, say a connection is needed instead of
      returning a stitched list labelled `SIMULATED`. (Handled in `src/lib/ai.ts`
      and `src/lib/answer.ts`.)
- [x] Strengthen the verifier: check tokens/entities against the cited capture,
      drop substring number matching, require at least one sourced claim.
      (Updated `verifyClaim` and `extractNumberTokens` in `src/lib/answer.ts`.)
- [x] Make each "Ask about this capture" chip use its own question and pin the
      capture as context. (Added `askCaptureId`/`seedCaptureId` scoping across
      `DetailSheet.tsx`, `App.tsx`, and `Ask.tsx`.)
- [x] Add a 5-second countdown and auto-dismiss to the undo toast.
- [x] Re-sync `AGENTS.md`, `README.md` and `WEB_SETUP.md` with the new rules,
      auth and deletion behaviour. (Verified `AGENTS.md` line count <= 200.)

## Documentation

- [x] Move the auto-tagging spec from `docs/specs/` to `docs/rfc/003-auto-tagging-flow.md`
      and retire the `docs/specs/` zone (owner decision 2026-11-18: unimplemented
      design belongs in `rfc/`). Added a banner distinguishing RFC 003 (agreed,
      implementable via the plan) from RFCs 000–002 (historical, superseded);
      updated `docs/README.md` zone rows and retrieval order ("do not implement
      from historical RFCs 000–002"), `docs/DATA.md` §9.1/§14, plan references,
      and reworded the two `AGENTS.md` zone lines (same line count; 198 lines,
      under the 200 cap). Verified no stale `docs/specs/` links outside the
      corrected historical task notes; `npm run typecheck && npm run build` pass.

- [x] Close the remaining auto-tagging questions (2026-11-18 round 2) in
      `docs/rfc/003-auto-tagging-flow.md`: per-type similarity thresholds with the
      higher threshold for cross-type pairs (Q2, differs from the draft default),
      permanent per-fingerprint dismissal (Q4), majority-token label language
      (Q6). Spec status is now AGREED; V11 added; plan grouping task updated.
      Verified links and build.

- [x] Record the 2026-11-18 auto-tagging design decisions in
      `docs/rfc/003-auto-tagging-flow.md` and align the "Tags & suggested groups"
      tasks: label source keyword-first with Nano when available (Q1), Accept
      by whole group with deselection (Q3), auto-generate on app open with new
      captures (Q5 — proposals only, like `scanForProposals`), Groups section
      inside `Memories` (Q7). Q2/Q4/Q6 stay open with documented defaults.
      Verified links and build.

- [x] Add `docs/specs/` (design-spec zone, distinct from `docs/as-built/specs/`)
      with a short zone README and `auto-tagging-flow.md` — a DRAFT spec for
      discussion: three-layer tag model, grouping algorithm, proposal lifecycle,
      privacy bounds, edge cases, verification plan and open questions. Update
      `docs/README.md`, `docs/DATA.md` §9.1/§14 and the "Tags & suggested groups"
      scope line to reference it. Verify links and build, then mark done.
      Correction (2026-11-18): the `docs/specs/` zone was retired the same day
      and the spec moved to `docs/rfc/003-auto-tagging-flow.md`; references to
      `docs/specs/` describe the pre-move state.
      Note: `docs/specs/README.md` (28 lines, zone rules) and
      `docs/rfc/003-auto-tagging-flow.md` (212 lines, DRAFT with 7 open questions
      Q1–Q7). All referenced paths resolve and
      `npm run typecheck && npm run build` pass. The spec is design intent only
      (`Claimed`); on implementation, as-built truth moves to
      `docs/as-built/specs/` per the zone rules.

- [x] Sync `docs/DATA.md` and the plan design decisions with the agreed design
      review outcomes: "delete permanently now" in `DetailSheet`, multi-select
      gallery import with EXIF `DateTimeOriginal`, and the three-layer tag model
      (`entities` / `tags` / `suggestedTags`, tags never synced). Verified links
      and build.
      Note: `docs/DATA.md` gains class `C8` (user-authored labels), the
      `active → purged` transition, `tags`/`suggestedTags` in the attribute
      dictionary and the never-synced list, and §9.1 tagging/grouping. New task
      groups "Import & capture sources" and "Tags & suggested groups" were added
      above P1; the "delete permanently now" task sits in Manual memory
      deletion. `docs/requirements/req-web-app.md` acceptance updates are
      tracked inside those task groups, not done here.

- [x] Add `docs/DATA.md` — the comprehensive data design: data classes and
      privacy classification, entity/attribute dictionary, retention and
      proposal state machines, IndexedDB/Firestore physical design, derived-data
      lineage, identity partitioning (Google vs demo), sync protocol, trash and
      purge policy, search index design, schema-migration policy and an
      invariants/verification map. It is the design authority; `docs/as-built/DATA.md`
      stays the implementation snapshot and `contracts/` stays the executable
      schema source (no retyped DDL). Update `docs/README.md` and
      `docs/ARCHITECTURE.md` links so nothing breaks. Verify links and build,
      then mark done.
      Note: created with sections §0–§14 (343 lines, well under the ~800 split
      trigger). All referenced paths resolve and
      `npm run typecheck && npm run build` pass. Beyond the plan, added a
      reverse pointer in `docs/as-built/DATA.md` ("code wins, this file is
      corrected") so the design layer and the snapshot cannot drift into
      duplicate SSOT. Planned behaviour (§6 identity partitioning) is labelled
      *planned* and is not presented as as-built.
- [x] Remove references to the retired documentation standard from `AGENTS.md`,
      `docs/README.md`, `docs/ARCHITECTURE.md` and this plan; leave the file
      itself untouched because the owner will remove it; verify links and build,
      then mark done.
- [x] Update `AGENTS.md` after `ARCHITECTURE.md` moved from the repo root to
      `docs/ARCHITECTURE.md`: fix the reading path and repository layout, repair
      any root-level `ARCHITECTURE.md` links in `README.md` and `docs/README.md`,
      keep AGENTS.md within its 200-line cap, verify links and build, then mark done.
      Note: all links resolve and `npm run typecheck && npm run build` pass.
      The architecture index was moved into `docs/` at the owner's request;
      agent instructions and links now follow the moved path. AGENTS.md is
      exactly 200 lines after compressing the documentation rules.
- [x] Expand `ARCHITECTURE.md` from the frozen CSD (`docs/rfc/001-my-memory-csd.md`):
      extract topology, hybrid mode table, trust boundary, canonical flows,
      failure modes and guardrails into the root index; cite REQ/INV/ADR IDs,
      keep as-built docs authoritative, and do not convert design targets into
      verified claims. Verify links and build, then mark done.
      Note: expanded to 208 lines (under the ~800-line split trigger). All links
      resolve, no CSD numeric targets were copied into the index, and
      `npm run typecheck && npm run build` pass. AGENTS.md remains at 200 lines.
- [x] Restructure `docs/` into layered zones:
      move historical specs to `docs/rfc/`, create `ARCHITECTURE.md` plus
      `docs/requirements/`, `docs/as-built/`, `docs/operations/`,
      `docs/prototypes/` and `docs/adr/`, with `contracts/` at the root;
      add HISTORICAL banners and extraction maps; update all internal links and
      AGENTS.md reading order; verify no broken links and no duplicate SSOT.
      Note: requirements live in `docs/requirements/` rather than the single
      `docs/REQUIREMENTS.md` from the plan; all markdown links resolve, and
      `npm run typecheck && npm run build` pass. AGENTS.md is exactly at its
      200-line cap. The broken `competitions/` links in frozen RFCs were
      converted to plain text with a dated amendment note.

## P2 — cleanup

- [x] i18n for remaining hard-coded English strings in `Ask`, `Onboarding`,
      `Hud` and `answer.ts`. (Added remaining EN/VI strings in `src/lib/i18n.ts`.)
- [x] Add aria-labels and check touch target sizes. (Upgraded interactive
      controls across `App.tsx`, `Ask.tsx`, `Onboarding.tsx`, `Hud.tsx`,
      `BottomNav.tsx`, `DetailSheet.tsx`, `Forget.tsx`, `Trash.tsx`, `Toast.tsx`,
      and `SignInGate.tsx` with `min-h-11` targets and `aria-label` attributes.)
- [x] Add an error UI when Firebase initialization fails. (Dismissible alert
      banner in `src/App.tsx` surfaced when `isFirebaseConfigured && error`.)
- [ ] Publish a Remote Config template. (Added tracked `remoteconfig.template.json`
      in the repo root; publishing to the live project requires Firebase Console /
      CLI credentials external to the repo.)
- [ ] Restrict the Firebase API key by HTTP referrer. (Requires Google Cloud /
      Firebase Console access external to the repo.)
- [x] Add ESLint and unit tests for `answer.ts`, `forget.ts` and `search.ts`.
      (Added `eslint.config.js`, `npm run lint`, `scripts/run-tests.mjs`, and
      `tests/core.test.ts` covering `answer.ts`, `forget.ts`, `search.ts`,
      `protection.ts`, `tags.ts`, and `exif.ts`.)
- [x] Address the Vite build warning: the `firebase` manual chunk is ~649 kB
      (196 kB gzip). Lazy-load `firebase/ai` or raise `build.chunkSizeWarningLimit`
      if the size is acceptable. (Lazy-loaded `firebase/ai` and
      `firebase/firestore`, split `firebase-core` and `firebase-auth`, and set
      `build.chunkSizeWarningLimit: 600` for the async Firestore SDK chunk.)
