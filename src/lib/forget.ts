import type { CaptureRecord, Decision, ForgetProposal } from '../types';
import { cosine } from './embeddings';
import { captureExpiry } from './expiry';

function expiryPassed(expiryDate: string): boolean {
  const match = expiryDate.trim().match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return false;
  const maxDay = new Date(year, month, 0).getDate();
  const day = match[3] ? Number(match[3]) : maxDay;
  if (day < 1 || day > maxDay) return false;
  const expiry = new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
  return expiry < Date.now();
}

/**
 * Local Forget engine. Produces proposals only — it never mutates captures.
 * F4: protected captures are excluded regardless of score.
 */
export function scanForProposals(
  captures: CaptureRecord[],
  duplicateThreshold: number,
  existing: ForgetProposal[],
): ForgetProposal[] {
  const now = new Date().toISOString();
  const candidates = captures.filter(
    (c) => c.retentionState === 'active' && !c.protectedReason,
  );
  const already = new Set(existing.map((p) => p.captureId));
  const proposals: ForgetProposal[] = [];

  for (const capture of candidates) {
    if (already.has(capture.id)) continue;

    // F1 — Duplicate: a later capture is proposed, never the earlier one.
    let best: { other: CaptureRecord; score: number } | null = null;
    for (const other of candidates) {
      if (other.id === capture.id) continue;
      if (
        other.capturedAt > capture.capturedAt ||
        (other.capturedAt === capture.capturedAt && other.id >= capture.id)
      ) {
        continue;
      }
      if (other.type !== capture.type) continue;
      const score = cosine(capture.embedding, other.embedding);
      if (score >= duplicateThreshold && (!best || score > best.score)) best = { other, score };
    }
    if (best) {
      proposals.push({
        id: `prop_${capture.id}_dup`,
        captureId: capture.id,
        reason: 'duplicate',
        evidence: `Duplicate ${best.score.toFixed(2)} of the ${best.other.type} captured earlier (${new Date(best.other.capturedAt).toLocaleDateString()}). One copy is enough as evidence.`,
        score: best.score,
        relatedCaptureId: best.other.id,
        createdAt: now,
      });
      continue;
    }

    // F2 — Expired: only a capture's own stated expiryDate counts.
    const expiry = captureExpiry(capture);
    if (expiry && expiryPassed(expiry)) {
      proposals.push({
        id: `prop_${capture.id}_exp`,
        captureId: capture.id,
        reason: 'expired',
        evidence: `Its own expiry date (${expiry}) has passed. The content is no longer usable.`,
        createdAt: now,
      });
    }
  }
  return proposals;
}

export function moveToTrash(
  capture: CaptureRecord,
  retentionDays: number,
  source: 'proposal' | 'manual',
): CaptureRecord {
  const now = Date.now();
  return {
    ...capture,
    retentionState: 'trashed',
    trashedAt: new Date(now).toISOString(),
    purgeAt: new Date(now + retentionDays * 86_400_000).toISOString(),
    trashSource: source,
  };
}

export function applyDecision(
  capture: CaptureRecord,
  decision: Decision,
  retentionDays: number,
): CaptureRecord {
  if (decision === 'keep') {
    // "Keep" is feedback: this capture stays active and is never proposed again
    // for the same reason because the proposal is marked decided.
    return { ...capture, retentionState: 'active' };
  }
  return moveToTrash(capture, retentionDays, decision === 'manual' ? 'manual' : 'proposal');
}

export function purgeExpiredTrash(
  captures: CaptureRecord[],
  nowMs = Date.now(),
): { active: CaptureRecord[]; purged: CaptureRecord[] } {
  const active: CaptureRecord[] = [];
  const purged: CaptureRecord[] = [];
  for (const capture of captures) {
    if (capture.retentionState === 'trashed' && capture.purgeAt) {
      const purgeMs = new Date(capture.purgeAt).getTime();
      if (Number.isFinite(purgeMs) && purgeMs <= nowMs) {
        purged.push(capture);
        continue;
      }
    }
    active.push(capture);
  }
  return { active, purged };
}
