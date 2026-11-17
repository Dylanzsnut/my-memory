# My Memory — Web app setup

React + Vite + TypeScript implementation of the Web/Chrome companion described in
`design/my-memory-csd.md`.

## Run locally

```bash
npm install
cp .env.example .env      # fill in Firebase values for live inference; leave blank for local demo mode
npm run dev               # http://localhost:5173
npm run build             # type-check + production build
```

Without Firebase config the app runs in **local demo mode**: the full UI, indexing,
bilingual search, evidence verification, forget queue and telemetry HUD work against
synthetic sample data, and every AI call is labelled `LOCAL DEMO` in the HUD. Nothing
is faked as on-device or cloud inference.

## Enable real Firebase AI Logic

1. Create a Firebase project and register a **Web app** in Project settings.
2. In the console go to **AI Services → AI Logic → Get started** and choose the
   **Gemini Developer API**. This enables the required APIs and enforces App Check.
3. Paste the Web app config values into `.env` (`VITE_FIREBASE_*`).
4. For local development, App Check uses the **debug provider**: open the browser
   console, copy the printed debug token, and allow-list it under
   **App Check → Apps → Manage debug tokens**.
5. Optional: put your reCAPTCHA v3 site key in `VITE_RECAPTCHA_SITE_KEY` for a
   production attestation provider.
6. Optional: set Remote Config keys `cloud_model`, `duplicate_threshold`,
   `retrieval_threshold`, `trash_retention_days` to tune behaviour without a rebuild.

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

Web structured output uses `Schema` helpers on-device (`responseConstraint`) and
`responseSchema` / `responseMimeType: application/json` in the cloud — the Web SDK
does not use Android's KSP `@Generable`.

## Architecture map

| File | Responsibility |
|---|---|
| `src/lib/firebase.ts` | Firebase app, App Check, Firestore offline persistence (metadata only), Remote Config, AI backend |
| `src/lib/ai.ts` | Hybrid inference adapter: `ONLY_ON_DEVICE` extraction, `PREFER_ON_DEVICE` short answers, `ONLY_IN_CLOUD` synthesis, `inferenceSource` label |
| `src/lib/embeddings.ts` | Local embedding provider with a pluggable neural hook; deterministic lexical default |
| `src/lib/store.ts` | IndexedDB: originals, capture records, proposals, HUD events |
| `src/lib/search.ts` | Local vector + lexical bilingual search |
| `src/lib/answer.ts` | Fail-closed claim verification — no citation, no answer |
| `src/lib/forget.ts` | F1 duplicate / F2 expired proposals, F4 protections, human-only decisions |
| `src/lib/i18n.ts` | EN / VI interface strings |

## Known deviations from the CSD (call these out in submissions)

- The embedder is a deterministic local lexical provider so search works offline with
  no model download. The CSD's pinned EmbeddingGemma 2 is deliberately not substituted
  with another neural model; image/audio are represented by their derived text, so
  native multimodal retrieval is not yet demonstrated. `src/lib/embeddings.ts` is the
  boundary where that provider would be plugged in.
- On-device ASR uses the browser SpeechRecognition API where available; a typed
  transcript fallback keeps the flow usable elsewhere. Original audio capture is not
  yet persisted as a blob.
- Latency and match numbers shown in the UI are measured locally where possible; the
  design targets (0.4 s answer, <1 s search, 0.97 similarity) are not claimed as
  measured benchmarks.
