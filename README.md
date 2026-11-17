# My Memory

**A second memory in your pocket.** Capture a photo, a voice memo, or a note, then ask for it later
in plain words — the answer comes back with the original capture as evidence, runs locally, and
never deletes anything without your approval.

> **Concept stage.** The design is documented, but no application code, hosted build, or demo video
> has been published yet. See [Project status](#project-status).

## About

My Memory (also called *Pocket Knowledge*) is a privacy-first personal knowledge app for the
**Android (primary) + Web/Chrome (companion)** track.

It solves a familiar failure: you capture a receipt, a licence plate, or a medicine box, and then
cannot find it again. Phone galleries search by name and date; note apps demand folders and tags at
the exact moment you have no patience for them; cloud photo search sends private material off the
device. My Memory adds the missing layer — **a memory with an evidence rule**: one local store for
every capture type, retrieval that returns the original as proof, and a forgetting policy where the
machine proposes and the human decides.

The design is built on four principles:

- **On-device by default.** Transcription, embedding, and search stay on the phone; the cloud is a
  last resort for long, cross-capture synthesis only.
- **Evidence or refusal.** No answer without a cited capture — "not found" is a valid result.
- **Human-in-the-loop forgetting.** The app proposes what to forget; nothing is deleted without
  approval, and approved items sit in a recoverable trash for 30 days.
- **Offline is the default, not a degraded mode.** Capture, indexing, and short answers work with
  the network unplugged.

## Features

- **Capture anything, organise nothing** — a photo, voice memo, or note, with no filename, folder,
  or tag requested at capture time.
- **Ask in plain words** — e.g. "when does mum's medicine expire?" returns the expiry with the
  original photo, date, and match score attached.
- **Cited answers** — every factual claim links to the source capture; uncited claims are suppressed
  rather than softened.
- **Hybrid inference** — Gemini Nano 4 runs locally through Firebase AI Logic in `PREFER_ON_DEVICE`
  mode; long synthesis escalates to the cloud. The response's `inferenceSource` drives an on-device
  vs cloud-synthesised label in the UI, so a fallback is never mistaken for a local result.
- **Offline-first local search** — a local vector index keeps photos, transcriptions, and notes in
  one searchable space, working in airplane mode.
- **Forgetting Lab** — duplicate and expiry proposals carry a reason and a link to the original.
  Unique health or safety captures are protected, and a "keep" decision teaches the curator.

## How it works

| Step | What happens |
| :--- | :--- |
| **Save** | Firebase AI Logic calls Gemini Nano 4 in `PREFER_ON_DEVICE` mode to return structured JSON (`summary`, `entities`, `expiryDate`). The original blob is stored read-only next to its embedding and is never replaced by the summary. |
| **Ask** | Local search finds candidate captures offline. Nano 4 resolves intent and produces a short, cited answer; only long cross-capture synthesis escalates to the cloud, sending light JSON summaries rather than originals. |
| **Forget** | Cosine similarity over embeddings plus extracted expiry dates feed a proposal queue. The user approves or keeps each item; approved captures move to a 30-day recoverable trash. Remote Config may tune the scoring threshold, never the forgetting rule. |

```mermaid
flowchart LR
    C["Capture: photo / voice / note"] --> I["On-device ingest\nGemini Nano 4 + embeddings"]
    I --> DB[("Local store\noriginals + vector index")]
    Q["Question"] --> S["Local search · offline"]
    S --> DB
    S --> A["Answer with citation\nON_DEVICE or IN_CLOUD label"]
    DB --> F["Forgetting Lab\nproposals with evidence"]
    F --> H{"Human approves?"}
    H -->|yes| T["30-day recoverable trash"]
    H -->|no| K["Keep → feedback"]
```

## Tech stack

The models are pinned by the build specification: **Gemini Nano 4 only** for on-device inference
(no Nano 3 / Nano 2 downgrade) and **EmbeddingGemma 2 only** as the embedder.

| Layer | Choice |
| :--- | :--- |
| Hybrid inference | Firebase AI Logic Hybrid Inference SDK, `PREFER_ON_DEVICE` |
| On-device model | Gemini Nano 4 (Chrome Prompt API on Web / on-device runtime on Android) |
| Cloud escalation | `gemini-3.8-flash`, with `gemini-3.5-flash-lite` as the default fallback |
| Embeddings | EmbeddingGemma 2, on-device |
| Transcription / OCR | On-device ASR and OCR |
| Platforms | Android (Kotlin) primary; Web (Chrome) + IndexedDB companion |
| Firebase services | App Check, Cloud Firestore (offline persistence), Remote Config |
| Output | Schema-constrained structured JSON |
| Web scaffold | Vite + React + TypeScript + Tailwind CSS |

## Repository layout

- [`docs/req/idea.md`](docs/req/idea.md) — conceptual design and architecture record (8 sections).
- [`docs/design/my-memory-csd.md`](docs/design/my-memory-csd.md) — build specification; pins the
  model choices and guardrails.
- `docs/uiux/` — UX architecture, interaction specs, and screen designs.
- `LICENSE` — Apache License 2.0.

## Project status

As of **2026-11-17**, nothing has been pushed beyond the repository skeleton: `main` is a single
commit (`d11ee62`, "Initial commit") containing only `LICENSE` and a one-line `README.md`. There is
no application code, hosted build, demo video, or real capture data in the repository.

| Surface | Status |
| :--- | :--- |
| Public repository | Initialized — `Dylanzsnut/my-memory` |
| Android (Kotlin) capture and on-device query | Not pushed |
| Web/Chrome companion (Prompt API + IndexedDB) | Not pushed |
| Hybrid inference, citation evidence, deletion approval | Not pushed |
| Demo video or hosted build | None |

## Getting started

The app is not runnable yet. The design documents and a Vite/React scaffold exist in the working
tree but have not been pushed; the public repository currently contains only the license and this
README. Once the implementation lands, the intended local workflow is:

```bash
npm install
npm run dev      # start the Vite dev server
npm run build    # type-check and build
```

For the full design and the build-time checks that still need validating, start with
[`docs/req/idea.md`](docs/req/idea.md) and [`docs/design/my-memory-csd.md`](docs/design/my-memory-csd.md).

## Roadmap

- [ ] Push the Android capture and on-device query implementation.
- [ ] Build the Web/Chrome companion (Prompt API + IndexedDB).
- [ ] Wire hybrid inference, citation evidence, and deletion approval.
- [ ] Publish a hosted build and an English demo video (under 3 minutes).

## License

Apache License 2.0 — see [`LICENSE`](LICENSE).
