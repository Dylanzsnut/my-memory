# 'My Memory' — UX Architecture, Flowchart & Interaction Loops Specification

> **Product Vision:** A second memory that lives in your pocket — like human memory, except it never makes things up. Built local-first with on-device AI, 1-tap capture, 100% cited evidence retrieval, and a human-supervised mindful forgetting queue.

---

## 1. Executive Summary & Design System

* **Brand / Design System:** Warm Archival Modernism (`#fffdf8` warm archival cream canvas, `#e4571e` terracotta primary CTA accents, `#14705c` forest teal badges, `#1c1710` rich archival ink, Noto Serif headlines paired with clean geometric body text).
* **Core Value Pillars:**
  1. **Zero-effort capture:** Snap, dictate, or note in under two seconds. No folders, tags, or file naming required.
  2. **Never fabricates (No Citation, No Answer):** Answers must cite the original captured photo, audio recording, or note. If no evidence exists, the app explicitly states "Not found in memory."
  3. **Local-first guarantee:** All vector indexing and initial retrieval run 100% on-device. Zero data leaks to third-party clouds.
  4. **Mindful forgetting:** The app tidies itself, but operates under a non-negotiable rule: **AI suggests, only human approves**.

---

## 2. Information Architecture (IA)

```
[ My Memory App ]
│
├── Phase 1: Jargon-Free Onboarding Flow (3 Steps)
│   ├── Step 01: On-Device Guarantee (Private & secure, nothing leaves your phone)
│   ├── Step 02: One Shared Memory (Photos, voice notes & thoughts in one unified index)
│   └── Step 03: Your Rules & Privacy (100% control, you decide what to keep)
│
└── Phase 2: Core App Architecture (Unified 3-Tab Model + Contextual Detail Sheet)
    │
    ├── Tab 1: Memories (Feed & 1-Tap Capture)
    │   ├── Top Header (Greeting, Memory Counter, Privacy Status Indicator)
    │   ├── 1-Tap Slim Capture Toolbar (Snap [Camera], Record [Audio], Note [Text])
    │   └── Reverse-Chronological Timeline Feed ("Today", "Yesterday", grouped by date)
    │       └── Tap on Memory Card ──► [Contextual Modal Sheet: Memory Detail & Evidence]
    │
    ├── Tab 2: Ask (Natural Language Retrieval & Synthesis)
    │   ├── Conversational Search Bar & Suggested Query Chips ("When does mum's medicine expire?")
    │   ├── Direct Synthesized Response + Primary Evidence Card with source thumbnail & timestamp
    │   └── Tap on Evidence Card ──► [Contextual Modal Sheet: Memory Detail & Evidence]
    │
    ├── Tab 3: Forget (Guided Review Queue)
    │   ├── Review Queue of AI-flagged items (Duplicates [e.g. 0.97 match], Expired OTPs/Receipts)
    │   ├── Clear Human-Readable Reasons ("Duplicates photo from 40s ago")
    │   ├── Decision Actions: "Move to 30-Day Trash" vs "Keep" (Teaches preferences)
    │   └── Protected Item Safeguard (Single-copy medical records & vital items are never queued)
    │
    └── Contextual Drill-Down: Memory Detail & Evidence Sheet (NOT a root tab)
        ├── Sheet Grab Indicator & Quick Dismissal ("Back" / "Done")
        ├── High-Resolution Image Preview / Audio Playback Player / Extracted Text
        ├── On-Device Hardware Enclave & Verification Proof Badge
        └── Contextual Bridge: "Ask about this capture" chips returning directly into Ask Tab
```

---

## 3. The 4 Core Interaction Loops

### Loop 1: The Zero-Effort Capture Loop (`Memories` Tab)
* **Goal:** Capture raw moments in under two seconds with zero cognitive load.

```
User Need to Record
       │
       ▼
[ 1-Tap Slim Toolbar: Snap / Record / Note ]
       │
       ├─► Snap (Camera) ────► On-device OCR & visual embedding (~1.2s)
       ├─► Record (Voice) ───► On-device ASR transcription (~0.4s)
       └─► Note (Text) ──────► Instant text vectorization (<0.1s)
       │
       ▼
Unified Multi-modal Vector Index (Local, on-device only)
       │
       ▼
Reverse-Chronological Timeline Feed (Grouped by "Today", "Yesterday", etc.)
       │
       ▼
Memory Card with verified status badge & preview
```

* **Key UX Safeguards:**
  * **Instant Write:** Capture never asks "Which folder?" or "Add tags". The user snaps or speaks and immediately returns to their task.
  * **Zero Search Bar Redundancy:** Search is intentionally relocated to the **Ask** tab, keeping the feed clean, uncluttered, and capture-first.
  * **Tactile Feedback:** A subtle archival confirmation badge and gentle haptic confirm local persistence.

---

### Loop 2: The Inquiry & Proof Loop (`Ask` ↔ `Memory Detail`)
* **Goal:** Retrieve synthesized answers with 100% cited evidence, with no hallucinations.

```
[ Ask Tab ] 
       │
       ├─► Suggested Chips ("When does mum's medicine expire?") OR Custom Query
       │
       ▼
Local Semantic Retrieval (Matching photo OCR, voice transcripts, and notes)
       │
       ▼
Synthesized Answer Card + Direct Evidence Card
("In March 2027" · citing Capture #128)
       │
       ▼  (Tap evidence container or "See full memory →")
[ Contextual Sheet: Memory Detail & Evidence ]
       │
       ├─► Inspect high-res photo, full voice audio, raw OCR text & device proof
       │
       ├─► Tap "Back" / "Done" ──► Dismisses back to exact Ask search state
       │
       └─► Tap "Ask about this capture" chips ("What dosage?", "How much was it?")
             │
             ▼
           Re-enters [ Ask Tab ] with Memory #128 pre-attached as context
```

* **Key UX Safeguards:**
  * **No Citation, No Answer:** If matching similarity falls below threshold, the system displays *"Not found in memory"* rather than generating speculative filler.
  * **Prominent Touch Target:** The entire visual evidence card acts as a single interactive trigger with tactile micro-press feedback.
  * **Deep Context Continuity:** Modal dismissal retains query parameters, search scroll position, and active results without re-rendering.

---

### Loop 3: Drill-Down from Feed (`Memories` ↔ `Memory Detail`)
* **Goal:** Browse chronology and seamlessly inspect or query a specific past moment.

```
[ Memories Tab (Feed) ]
       │
       ▼  (Tap any timeline memory card)
[ Contextual Sheet: Memory Detail & Evidence ]
       │
       ├─► Review full captured details, timestamp, location, and verified proof
       │
       ├─► Dismiss via top grab bar or "Back" ──► Returns to exact Feed scroll position
       │
       └─► Tap Sticky Bottom CTA: "Ask AI about this memory"
             │
             ▼
           Direct bridge into [ Ask Tab ] with memory pinned as context
```

* **Key UX Safeguards:**
  * **Spatial Hierarchy:** Renders as an overlay sheet with a grab bar, reinforcing that the user remains within their browsing timeline.
  * **Contextual Bridge:** Seamlessly converts a passive browsing interaction into an active semantic query.

---

### Loop 4: The Mindful Forgetting Loop (`Forget` Tab)
* **Goal:** Prevent digital clutter while guaranteeing user safety through the iron rule: **AI suggests, only human approves**.

```
Background Scanner (Runs locally on schedule / idle)
       │
       ├─► Detects near-duplicates (e.g., 0.97 similarity burst shots)
       └─► Detects temporal expiry (e.g., OTP codes, temporary parking spots)
       │
       ▼
[ Forget Tab: Guided Review Queue ]
       │
       ▼  Each item presents human-readable rationale (e.g., "Duplicates photo from 40s ago")
       │
       ├───────────────┬────────────────┐
       ▼               ▼                ▼
[ Move to Trash ] [ Keep ]   [ Protected Items ]
       │               │                │
       │               │                └─► Single-copy health records & vital items
       │               │                    are shielded from the queue entirely
       │               ▼
       │          Feedback signal: AI adapts suggestion thresholds to user preference
       ▼
30-Day Trash Bin (Always restorable; zero permanent loss without 30-day grace)
```

* **Key UX Safeguards:**
  * **Two-Button Decision Engine:** Every queue card provides deliberate choices: `Move to Trash` (danger-soft) vs `Keep` (tactile archival cream/terracotta).
  * **No Auto-Purge:** Automatic bulk deletion is strictly forbidden to preserve trust.
  * **30-Day Safety Net:** Deleted items remain fully restorable from trash for 30 days.

---

## 4. Interaction Matrix & State Guidelines

| Component / State | Trigger | System Response | UX Safeguard |
|---|---|---|---|
| **1-Tap Capture** | Tap Snap / Record / Note | Opens camera / starts mic / opens pad | Bypasses folder dialog; indexes in background |
| **Search Query** | Submit text query in Ask tab | Runs local vector search (<1s) | Returns answer card + source evidence card |
| **Evidence Inspection** | Tap evidence photo or "See full memory" | Opens Memory Detail modal sheet | Preserves Ask tab state & query results |
| **Contextual Query** | Tap "Ask about this capture" chip | Switches to Ask tab with memory context | Pre-fills context badge in query field |
| **Forgetting Decision** | Tap "Move to Trash" | Moves item to 30-day recovery bin | Instant undo toast with 5-second countdown |
| **Protection Guard** | System scans blurry single photo | Exempts item from Forget queue | Protects sole records of health/identity |

---

*Document version: 2.1 (Updated to match unified 3-tab architecture and contextual detail sheet model).*
