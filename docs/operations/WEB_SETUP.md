# My Memory — Web app setup

React + Vite + TypeScript implementation of the Web/Chrome companion described in
`../rfc/001-my-memory-csd.md` (historical design). Current behaviour is documented
in `../as-built/` and tasks in `../plan/tasks.md`.

## Run locally

```bash
npm install
cp .env.example .env      # fill in Firebase values for live inference; leave blank for local demo mode
npm run dev               # http://localhost:5173
npm run build             # type-check + production build
```

Without Firebase config the app runs in **local demo mode**: the full UI, indexing,
bilingual search, evidence verification, forget queue and telemetry HUD work against
synthetic sample data, and every inference is labelled `SIMULATED` ("Local demo") in
the HUD — never falsely shown as on-device or cloud. When a live AI call fails, the
reason is surfaced in the HUD detail rather than silently swapped for a fake answer.

## Enable real Firebase AI Logic

1. Create a Firebase project and register a **Web app** in Project settings.
2. In the console go to **AI Services → AI Logic → Get started** and choose the
   **Gemini Developer API**. This enables the required APIs and enforces App Check.
3. Paste the Web app config values into `.env` (`VITE_FIREBASE_*`).
4. For local development, App Check uses the **debug provider**: open the browser
   console, copy the printed debug token, and allow-list it under
   **App Check → Apps → Manage debug tokens**.
5. For production, put your **reCAPTCHA Enterprise** site key in
   `VITE_RECAPTCHA_SITE_KEY` (the app uses `ReCaptchaEnterpriseProvider`). With
   `useLimitedUseAppCheckTokens: true` set in `getAI`, App Check must be enforced
   for AI Logic or calls fail with HTTP 403.
6. Optional: set Remote Config keys `cloud_model`, `duplicate_threshold`,
   `retrieval_threshold`, `trash_retention_days` to tune behaviour without a rebuild.

### Authentication & Firestore metadata sync (off by default)

- **Google sign-in vs Demo mode:** `SignInGate` offers private Google sign-in (with
  offline session cache after first sign-in) alongside an explicit **Demo mode** button
  that loads synthetic `demo: true` captures under `ownerUid: 'demo'`. `VITE_SEED_DEMO`
  defaults to `false`.
- **Per-user IndexedDB & one-time cleanup:** All captures, proposals, and HUD events
  are partitioned by `ownerUid`. First sign-in to a Google account runs a one-time
  `demo` cleanup so synthetic records never mix into personal space.
- **Firestore sync & rules:** Captures stay entirely on-device unless
  `VITE_ENABLE_FIRESTORE_SYNC=true`. `firestore.rules` enforces per-user ownership at
  `/users/{uid}/captures/{captureId}` with schema allowlist validation. Demo captures
  (`ownerUid: 'demo'`) are never synced. Original blobs, transcripts, tags, and
  embeddings are never written to Firestore.
- **Manual deletion & 30-day Trash:** Users can manually trash captures or permanently
  delete them in `DetailSheet`/`Trash` (plus **Delete account & local data** in the
  Account menu). Trashed captures purge automatically past `purgeAt` on app boot.

Models are pinned per the CSD: cloud synthesis uses `gemini-3.8-flash` with
`gemini-3.5-flash-lite` as the documented default fallback. Both names were
verified against the Firebase AI Logic model list on 2026-11-17.

## On-device inference (Chrome)

Hybrid on-device inference requires **Chrome on Desktop v139+** with
`chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` set to **Enabled**.
The first model download can take several minutes; onboarding calls
`initializeDeviceModel()` on a user gesture to pre-warm it. If Nano is unavailable,
the app follows CSD Flow 7: originals and local search stay available, extraction
falls back to a minimal local derivation, and inference is labelled accordingly.

On-device structured output uses `Schema` helpers passed as `responseConstraint` in
`onDeviceParams`. Cloud synthesis currently returns cited plain text (not JSON), so no
`responseSchema` is configured there. The Web SDK does not use Android's KSP `@Generable`.

## Architecture map

| File | Responsibility |
|---|---|
| `src/lib/firebase.ts` | Firebase app, Google Auth, App Check, Firestore `/users/{uid}/captures` metadata sync & delete, Remote Config, AI backend |
| `src/lib/ai.ts` | Hybrid inference adapter: `ONLY_ON_DEVICE` extraction, `PREFER_ON_DEVICE` short answers, `ONLY_IN_CLOUD` synthesis, offline guard, sensitive-entity redaction |
| `src/lib/embeddings.ts` | Local 512-dim signed lexical embedder with EN/VI stopwords, synonyms, and a pluggable neural hook |
| `src/lib/store.ts` | UID-partitioned IndexedDB: originals, capture records, proposals, HUD events, user meta |
| `src/lib/search.ts` | Local vector + lexical + tag bilingual search |
| `src/lib/answer.ts` | Fail-closed claim verification — exact number/code/token checks against cited capture |
| `src/lib/forget.ts` | F1 duplicate / F2 expired proposals, manual trash, `purgeAt` cleanup, F4 exclusions |
| `src/lib/protection.ts` | Automatic F4 protection for health/medicine, identity/safety, people photos, and blurry images |
| `src/lib/exif.ts` | JPEG EXIF `DateTimeOriginal` parser for imported photo timestamps |
| `src/lib/tags.ts` | Auto-tag similarity clustering (0.85 threshold), user tag vs auto entity helpers |
| `src/lib/i18n.ts` | EN / VI interface strings |

## Known deviations from the CSD (call these out in submissions)

- The embedder is a deterministic local lexical provider so search works offline with
  no model download. The CSD's pinned EmbeddingGemma 2 is deliberately not substituted
  with another neural model; image/audio are represented by their derived text, so
  native multimodal retrieval is not yet demonstrated. `src/lib/embeddings.ts` is the
  boundary where that provider would be plugged in.
- Voice memos record locally with `MediaRecorder` and persist `audioBlob` in IndexedDB
  alongside an optional user-typed transcript (`derivedText`), never calling browser
  `SpeechRecognition` or streaming audio externally. On-device neural ASR is not yet
  bundled in the Web companion.
- Latency and match numbers shown in the UI are measured locally where possible; the
  design targets (0.4 s answer, <1 s search, 0.97 similarity) are not claimed as
  measured benchmarks.
