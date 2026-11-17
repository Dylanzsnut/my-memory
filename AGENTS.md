# AGENTS.md — instructions for coding agents

## What this repository is

**My Memory** ("Pocket Knowledge") is a privacy-first personal knowledge app. Capture a photo,
voice memo, or note; ask for it later in plain words; get the answer back with the original capture
as evidence. The web build in `src/` is the Chrome companion; Android (Kotlin) is the primary
platform and is not in this repository yet.

Before changing behaviour, read:

- `README.md` — user-facing overview and current status.
- `docs/req/idea.md` — conceptual design, guardrails, and failure modes.
- `docs/design/my-memory-csd.md` — build specification; pins the models and acceptance criteria.
- `docs/uiux/` — UX architecture and screen designs.

## Non-negotiable invariants

These are product rules, not suggestions. Breaking them breaks the project's reason to exist.

1. **Privacy boundary.** Original blobs, transcripts, and embeddings never leave the device.
   Firestore receives **derived metadata only** (see `syncCaptureMetadata` in `src/lib/firebase.ts`).
   There is no cloud capture store.
2. **Citation or refusal.** No answer may contain a factual claim without a resolved source capture.
   `NOT_FOUND` / "Not found in memory" is the correct output when evidence is missing. Keep the
   fail-closed logic in `src/lib/answer.ts` intact.
3. **Human-in-the-loop forgetting.** `src/lib/forget.ts` only produces **proposals**. Never add an
   auto-delete path, bulk approval, or a background job that bypasses a recorded decision. Approved
   captures are recoverable for 30 days.
4. **Protected captures stay protected.** A unique health/safety capture (`protectedReason`) is
   excluded from proposals regardless of score. Remote Config may tune thresholds, never this rule.
5. **Provenance is explicit.** `InferenceSource` is `ON_DEVICE`, `IN_CLOUD`, or `SIMULATED`. Never
   present `SIMULATED` as a real model run. The UI label must come from the SDK response, not a guess.
6. **Model pins.** Gemini Nano 4 only for on-device inference (no Nano 3 / Nano 2 downgrade) and
   EmbeddingGemma 2 only as the production embedder. Do not silently substitute another model or a
   different embedder. `src/lib/embeddings.ts` deliberately uses a local lexical fallback — keep that
   boundary explicit rather than swapping in a neural provider unnoticed.
7. **Originals are immutable.** Derived text, structured JSON, and embeddings are indexes only. The
   original is read-only and the user may correct derived text without mutating it.
8. **English-first.** UI defaults to English; Vietnamese is an optional toggle. Documentation and
   demo copy stay in English.

## Repository layout

```
src/
  App.tsx                 screen/tab shell and top-level state
  main.tsx                entry point
  types.ts                all shared domain types (start here for data shapes)
  styles.css              Tailwind + custom styles
  components/
    Memories.tsx          captured items / timeline
    Ask.tsx               question input and answer view
    Forget.tsx            proposal review queue and decisions
    DetailSheet.tsx       capture detail + evidence sheet
    Onboarding.tsx        first-run flow, local/on-device guarantee
    BottomNav.tsx         Save / Ask / Forget navigation
    Hud.tsx               inference-source + latency readout
    Toast.tsx             transient feedback
  lib/
    firebase.ts           Firebase init, App Check, Remote Config, metadata sync
    config.ts             env-backed settings and defaults
    ai.ts                 on-device extraction, on-device/cloud answering
    answer.ts             claim verification and answer assembly
    search.ts             local retrieval + long-synthesis intent detection
    embeddings.ts         local embedding/cosine utilities
    store.ts              IndexedDB persistence and demo seed data
    forget.ts             proposal scan and decisions
    i18n.ts               English/Vietnamese strings
docs/                     design, requirements, UX (see above)
firebase.json             Hosting + Firestore rules config
firestore.rules           metadata-only demo rules
```

## Development

```bash
npm install
npm run dev         # Vite dev server
npm run typecheck   # tsc -b --pretty false
npm run build       # tsc -b && vite build
npm run preview     # serve dist/ locally
```

Run `npm run typecheck && npm run build` before declaring a task done. There is no automated test
suite yet; verify UI changes manually in the browser.

### Environment

Copy `.env.example` to `.env` and fill in the Firebase web app config. `.env` and `.env.*` are
gitignored (`.env.example` is the tracked template). Never commit real credentials, API keys, or
App Check debug tokens. In dev the debug token is printed in the browser console and must be
allow-listed in the Firebase console.

Settings come from `VITE_*` vars with safe defaults in `src/lib/config.ts`; Remote Config can
override `cloud_model`, `duplicate_threshold`, `retrieval_threshold`, and `trash_retention_days`.
`VITE_SEED_DEMO` seeds synthetic captures on first run — these are marked `demo: true` and must never
be represented as real user data.

## Firebase setup

Firebase AI Logic requires two enabled APIs. With the **Gemini Developer API** provider:

- `generativelanguage.googleapis.com`
- `firebasevertexai.googleapis.com`

With the **Agent Platform Gemini API** (formerly Vertex AI; requires Blaze):

- `aiplatform.googleapis.com`
- `firebasevertexai.googleapis.com`

Enabling services alone is not enough — run through the Firebase console **AI Services → AI Logic →
Get started** flow (or `npx firebase-tools@latest init ailogic`) so the service account is provisioned
and the API key allowlist is set. App Check enforcement is required for AI Logic.

`firestore.rules` currently uses open demo rules for an unauthenticated judging demo. They are not
production-safe: replace them with per-user (`request.auth.uid`) rules before any public release,
and never widen them to include blobs, transcripts, or embeddings.

### Firebase skills

Firebase skills are installed on demand and are **not** committed to this repository. If they are
missing from `.agents/skills/`, pull them from the official source before proceeding:

```bash
npx skills add firebase/agent-skills
```

Source and skill list: <https://firebase.google.com/docs/ai-assistance/agent-skills>

Run this from the repository root so the skills install locally in this project, not globally —
do not pass `-g`. To refresh later: `npx skills update`. The installed files and `skills-lock.json`
are gitignored.

## Working style

- Keep changes small and scoped; do not reformat untouched files.
- Match existing naming and module boundaries: pure logic goes in `src/lib/`, UI in `src/components/`.
- Preserve the `InferenceSource` and `Claim` data shapes; the HUD and evidence sheet depend on them.
- When adding an inference path, make the fallback explicit and label it; never degrade silently.
- When touching the forgetting flow, re-read §3.4 of `docs/req/idea.md` first.
- Avoid adding third-party dependencies unless there is no local solution — the app must work offline.
- Describe limitations honestly in docs; design targets (e.g. sub-second search) are not measured
  benchmarks.

## Quick checklist before committing

- [ ] `npm run typecheck && npm run build` pass.
- [ ] No secrets, `.env`, or debug tokens staged.
- [ ] No original/derived content added to Firestore writes.
- [ ] No uncited claims or silent model substitution introduced.
- [ ] Forgetting remains proposal-only; protected captures stay excluded.
- [ ] Demo data is still marked as demo.
