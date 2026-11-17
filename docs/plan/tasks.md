# My Memory — Web app task plan

Scope: the Web/Chrome companion only. Google sign-in is **mandatory**. Manual
memory deletion is supported in addition to the Forget proposal queue. All
hackathon submission tasks (Android scope, demo video, judge instructions,
disclosure text, submission copy) are intentionally out of scope.

## Design decisions (defaults — change before implementation if needed)

- **Manual delete:** deleting a memory from Memories or the detail sheet moves it
  to the 30-day trash. From the trash the user can restore it or permanently
  delete it with a confirmation. A manual delete is recorded separately from a
  Forget proposal approval.
- **Bulk delete:** not supported. Only one memory at a time, to preserve the
  "no automatic or bulk purge" rule.
- **Protected captures:** still manually deletable, with a stronger
  confirmation. Auto-proposals continue to exclude them.
- **Auth:** no guest mode. The first sign-in needs a network connection; after
  that the session is cached and the local index works offline.
- **Seed demo data:** dev builds only, behind an explicit flag. Real signed-in
  users start with an empty memory.
- **Firestore sync:** off by default (`VITE_ENABLE_FIRESTORE_SYNC=false`). The
  shipped rules deny all access; sync stays off until Firebase Auth and the
  per-user rules template are active. No data leaves the device by default.

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
- [ ] Rebuild and redeploy Hosting from the new commit.
- [ ] Fix `answer.ts`: set `notFound = verified.length === 0` so a "Not found"
      answer never renders with the "Verified from your capture" banner.
- [ ] Console: enable AI Logic → Get started with the Gemini Developer API.
- [ ] Console: register the reCAPTCHA Enterprise key for the Web app under App
      Check, then enable enforcement.
- [ ] Smoke test live in Chrome Desktop 139+ with the Prompt API flag enabled:
      on-device extraction, on-device answer, cloud synthesis.
- [ ] Voice: stop using the Web Speech API (Chrome sends audio to Google
      servers). Record with `MediaRecorder` and store the blob locally.
- [ ] Voice: remove the fabricated `"Sample voice memo transcript"` string;
      leave the transcript empty or let the user type it.
- [ ] Voice: add audio playback in `DetailSheet`.
- [ ] Onboarding: probe `LanguageModel.availability()` and show the real model
      state instead of a hard-coded "Ready ✓".
- [ ] Flow 7: show a banner when Nano is unavailable and label cloud answers
      explicitly.
- [ ] Offline: add a service worker and manifest (PWA) so a reload works with
      the network off.
- [x] Offline: no third-party font requests. Result differs from plan: removed
      the Google Fonts `<link>` from `index.html` and switched to system font
      stacks in `styles.css` instead of self-hosting font files. Self-hosting can
      still be added later if the exact typeface is required.

## Mandatory Google sign-in

- [ ] Console: enable the Google provider in Authentication.
- [ ] Add a sign-in gate before onboarding and the app, with loading and error
      states (popup blocked, offline).
- [ ] Cache the session after the first sign-in so the app works offline.
- [ ] Partition IndexedDB by `uid`; signing out must not delete local data, and
      switching accounts must not mix data.
- [ ] Disable demo seed data for real users; keep it only in dev builds behind
      a flag.
- [ ] Change Firestore sync to `/users/{uid}/captures/{id}`.
- [ ] Activate the per-user rules template in `firestore.rules` (compare
      `request.auth.uid` with the `{uid}` path segment) and deploy it.
- [ ] Add an account menu: show email, sign out.
- [ ] Add account deletion: remove local data and Firestore metadata.
- [ ] Verify user A cannot read user B's data, and that no blob, transcript or
      embedding is written to Firestore.

## Manual memory deletion

- [ ] Add a delete action to `DetailSheet` and to each card in `Memories`, with
      a confirmation dialog.
- [ ] Manual delete moves the memory to the 30-day trash and shows a 5-second
      undo toast.
- [ ] Share the delete implementation with the Forget flow (reuse
      `applyDecision` or add a common helper), but record "manual delete"
      separately from "proposal approved".
- [ ] Close any pending proposal for a manually deleted memory.
- [ ] Add a dedicated Trash screen: list, restore, days remaining. Currently
      the trash is only a section inside the Forget tab.
- [ ] Add "Delete permanently" in the Trash with a confirmation; remove the
      image and audio blobs from IndexedDB.
- [ ] Purge items past `purgeAt` on app open. Document this as an intentional,
      user-visible exception to the "no background deletion" rule.
- [ ] Sync the `trashed` state to Firestore and delete the metadata document on
      permanent deletion.
- [ ] Verify deleted captures never appear in search or Ask and are never sent
      to the cloud.
- [ ] Update `AGENTS.md` §3, `idea.md` §3.4, CSD §7.2 and i18n strings: the rule
      is "the AI never deletes on its own", not "deletion only via proposals".

## P1 — product quality

- [ ] Automatic F4 protection (health/medicine entities, blurry images, photos
      with people). Currently only the seed record has `protectedReason`.
- [ ] Improve search: stopwords, fewer hash collisions, broader EN/VI synonyms.
- [ ] Add a search/answer test set with in-corpus and out-of-corpus questions;
      out-of-corpus must return "Not found".
- [ ] Split the HUD into three counters: on-device, cloud, simulated.
- [ ] Filter or ask consent before sending sensitive `entities` (passwords,
      OTPs) to the cloud.
- [ ] For long synthesis while offline, say a connection is needed instead of
      returning a stitched list labelled `SIMULATED`.
- [ ] Strengthen the verifier: check tokens/entities against the cited capture,
      drop substring number matching, require at least one sourced claim.
- [ ] Make each "Ask about this capture" chip use its own question and pin the
      capture as context.
- [ ] Add a 5-second countdown and auto-dismiss to the undo toast.
- [ ] Re-sync `AGENTS.md`, `README.md` and `WEB_SETUP.md` with the new rules,
      auth and deletion behaviour.

## P2 — cleanup

- [ ] i18n for remaining hard-coded English strings in `Ask`, `Onboarding`,
      `Hud` and `answer.ts`.
- [ ] Add aria-labels and check touch target sizes.
- [ ] Add an error UI when Firebase initialization fails.
- [ ] Publish a Remote Config template.
- [ ] Restrict the Firebase API key by HTTP referrer.
- [ ] Add ESLint and unit tests for `answer.ts`, `forget.ts` and `search.ts`.
- [ ] Address the Vite build warning: the `firebase` manual chunk is ~649 kB
      (196 kB gzip). Lazy-load `firebase/ai` or raise `build.chunkSizeWarningLimit`
      if the size is acceptable.
