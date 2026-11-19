# Spec: auto-tagging & user tags

- Owning modules: `src/lib/tags.ts`, `src/lib/search.ts`, `src/components/DetailSheet.tsx`, `src/components/Memories.tsx` · Depth: STANDARD
- Related: RFC-003, ADR-005, ADR-007, REQ-002, REQ-003
- Owner: Duy · Last verified: 2026-11-18 · Against HEAD: local working tree

## 1. Invariants

| ID | Must always hold | Verified by |
|---|---|---|
| INV-401 | `tags` and `suggestedTags` are never written to Firestore (`syncCaptureMetadata`) | UNVERIFIED — checked in code, unit test added in P2 |
| INV-402 | `computeTagGroups` produces proposals (`suggestedTags`) only; `tags` are written only after an explicit human Accept or manual edit in `DetailSheet` | UNVERIFIED — checked in code, unit test added in P2 |
| INV-403 | Trashed captures (`retentionState === 'trashed'`) are excluded from grouping; protected captures remain groupable without altering protection | UNVERIFIED — checked in code |
| INV-404 | Sensitive tokens (OTP runs, password/PIN tokens) are filtered from candidate group labels (`isSensitiveLabelToken`) | UNVERIFIED — checked in code |

## 2. Rules at HEAD

- **Three layers**: `entities` (auto-extracted index, read-only with `auto` badge), `tags` (user-authored, survives re-extraction, boosts search), `suggestedTags` (local grouping proposals, never indexed before Accept).
- **Thresholds**: per-type similarity thresholds (`groupThresholdPhoto`, `groupThresholdVoice`, `groupThresholdNote`, default `0.85`, Remote Config tunable). Cross-type pairs use `Math.max(...)`.
- **Decisions**: `Accept` writes the label (or renamed label) to `tags` on the selected captures and re-embeds them locally; `Dismiss` persists the group fingerprint in `meta` (`dismissedTagGroups`).
