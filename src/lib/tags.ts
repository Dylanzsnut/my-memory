/**
 * Local embedding-based capture grouping and tag proposal engine (RFC-003).
 *
 * Strictly proposal-only: never writes to user `tags` without an explicit Accept.
 * Runs 100% locally offline and never sends labels, embeddings, or tags to cloud/Firestore.
 */
import type { AppSettings, CaptureRecord, CaptureType, TagGroupProposal } from '../types';
import { isSensitiveEntity } from './ai';
import { cosine, normalize } from './embeddings';

const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'or', 'is', 'are', 'was',
  'were', 'be', 'with', 'my', 'your', 'this', 'that', 'from', 'by', 'not', 'it', 'its',
  'as', 'but', 'if', 'about', 'into', 'here', 'there', 'just', 'remember', 'capture',
  'photo', 'voice', 'memo', 'note', 'untitled', 'today', 'yesterday', 'stored', 'device',
  'audio', 'unextracted', 'kept', 'sample', 'cua', 'va', 'cho', 'trong', 'nay', 'kia',
  'toi', 'la', 'co', 'mot', 'cac', 'nhung', 've', 'duoc', 'khong', 'khi', 'nho', 'ghi',
  'am', 'chu', 'anh', 'ban', 'tren', 'may', 'nay', 'nay', 'o', 'tai', 'tu', 'den',
]);

function thresholdForType(
  type: CaptureType,
  thresholds: Pick<AppSettings, 'groupThresholdPhoto' | 'groupThresholdVoice' | 'groupThresholdNote'>,
): number {
  if (type === 'photo') return thresholds.groupThresholdPhoto;
  if (type === 'voice') return thresholds.groupThresholdVoice;
  return thresholds.groupThresholdNote;
}

export function pairGroupThreshold(
  a: CaptureType,
  b: CaptureType,
  thresholds: Pick<AppSettings, 'groupThresholdPhoto' | 'groupThresholdVoice' | 'groupThresholdNote'>,
): number {
  return Math.max(thresholdForType(a, thresholds), thresholdForType(b, thresholds));
}

function isSensitiveCapture(capture: CaptureRecord): boolean {
  const blob = normalize([capture.summary, ...capture.entities, capture.derivedText || ''].join(' '));
  return /\b(?:password|mat khau|otp|verification code|secret|passcode|pin)\b/.test(blob);
}

export function isSensitiveLabelToken(raw: string, sensitiveTokens: Set<string>): boolean {
  const norm = normalize(raw).trim();
  if (!norm || norm.length < 2) return true;
  if (/^\d+$/.test(norm)) return true;
  if (/\d{4,}/.test(norm)) return true;
  if (/^(?:otp|password|passcode|pin|secret|token|credential|mat_khau|code)$/.test(norm)) return true;
  if (sensitiveTokens.has(norm)) return true;
  return false;
}

interface CandidateToken {
  norm: string;
  surface: string;
  isVi: boolean;
}

function extractCandidateTokens(capture: CaptureRecord): CandidateToken[] {
  const rawSources = [...capture.entities, ...(capture.tags || []), capture.summary];
  const seen = new Set<string>();
  const out: CandidateToken[] = [];
  const hasViContext = capture.language === 'vi';

  for (const source of rawSources) {
    const words = source
      .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean);
    for (const word of words) {
      const norm = normalize(word);
      if (!norm || norm.length < 2 || STOPWORDS.has(norm) || seen.has(norm)) continue;
      seen.add(norm);
      const hasDiacritics = Array.from(word).some((ch) => ch.charCodeAt(0) > 0x7f);
      out.push({
        norm,
        surface: word.toLowerCase(),
        isVi: hasDiacritics || (hasViContext && !/^[a-z]+$/i.test(word)),
      });
    }
  }
  return out;
}

export function deriveGroupLabel(members: CaptureRecord[]): string | null {
  const sensitiveTokens = new Set<string>();
  for (const member of members) {
    if (!isSensitiveCapture(member)) continue;
    for (const entity of member.entities) {
      const norm = normalize(entity).trim();
      if (norm && !['wifi', 'cafe', 'screenshot'].includes(norm)) {
        sensitiveTokens.add(norm);
      }
    }
  }

  let viWeight = 0;
  let enWeight = 0;
  const counts = new Map<string, { members: number; forms: CandidateToken[] }>();

  for (const member of members) {
    if (member.language === 'vi') viWeight += 1;
    else enWeight += 1;
    const tokens = extractCandidateTokens(member);
    for (const token of tokens) {
      if (isSensitiveLabelToken(token.surface, sensitiveTokens)) continue;
      const entry = counts.get(token.norm) || { members: 0, forms: [] };
      entry.members += 1;
      entry.forms.push(token);
      counts.set(token.norm, entry);
    }
  }

  const shared = Array.from(counts.entries())
    .filter(([, entry]) => entry.members >= 2)
    .sort((a, b) => b[1].members - a[1].members || b[0].length - a[0].length);

  if (!shared.length) return null;
  const preferVi = viWeight > enWeight;
  const [, best] = shared[0];
  const preferredForm =
    best.forms.find((f) => f.isVi === preferVi)?.surface || best.forms[0]?.surface || shared[0][0];
  return preferredForm.slice(0, 32);
}

export interface CaptureCluster {
  captureIds: string[];
  meanSimilarity: number;
}

/** Shared embedding clustering (connected components, min size 2), used by tag
 * proposals and by editable memory groups. Trashed captures are excluded. */
export function clusterCaptures(
  captures: CaptureRecord[],
  thresholds: Pick<AppSettings, 'groupThresholdPhoto' | 'groupThresholdVoice' | 'groupThresholdNote'>,
): CaptureCluster[] {
  const eligible = captures.filter((c) => c.retentionState !== 'trashed');
  const adj = new Map<string, { id: string; score: number }[]>();

  for (let i = 0; i < eligible.length; i++) {
    for (let j = i + 1; j < eligible.length; j++) {
      const a = eligible[i];
      const b = eligible[j];
      const score = cosine(a.embedding, b.embedding);
      const minScore = pairGroupThreshold(a.type, b.type, thresholds);
      if (score >= minScore) {
        (adj.get(a.id) ?? adj.set(a.id, []).get(a.id)!).push({ id: b.id, score });
        (adj.get(b.id) ?? adj.set(b.id, []).get(b.id)!).push({ id: a.id, score });
      }
    }
  }

  const visited = new Set<string>();
  const clusters: CaptureCluster[] = [];
  for (const seed of eligible) {
    if (visited.has(seed.id) || !adj.has(seed.id)) continue;
    const componentIds: string[] = [];
    const queue = [seed.id];
    visited.add(seed.id);
    while (queue.length) {
      const current = queue.shift()!;
      componentIds.push(current);
      for (const edge of adj.get(current) || []) {
        if (!visited.has(edge.id)) {
          visited.add(edge.id);
          queue.push(edge.id);
        }
      }
    }
    if (componentIds.length < 2) continue;

    const sortedIds = componentIds.slice().sort();
    const memberSet = new Set(sortedIds);
    let edgeSum = 0;
    let edgeCount = 0;
    for (const id of sortedIds) {
      for (const edge of adj.get(id) || []) {
        if (id < edge.id && memberSet.has(edge.id)) {
          edgeSum += edge.score;
          edgeCount += 1;
        }
      }
    }
    clusters.push({
      captureIds: componentIds,
      meanSimilarity: edgeCount ? edgeSum / edgeCount : 0,
    });
  }
  return clusters;
}

export function computeTagGroups(
  captures: CaptureRecord[],
  thresholds: Pick<AppSettings, 'groupThresholdPhoto' | 'groupThresholdVoice' | 'groupThresholdNote'>,
  dismissedFingerprints: string[] = [],
): { groups: TagGroupProposal[]; suggestedByCapture: Map<string, string[]> } {
  const dismissed = new Set(dismissedFingerprints);
  const byId = new Map(captures.map((c) => [c.id, c]));
  const groups: TagGroupProposal[] = [];
  const suggestedByCapture = new Map<string, string[]>();

  for (const cluster of clusterCaptures(captures, thresholds)) {
    const members = cluster.captureIds
      .map((id) => byId.get(id)!)
      .filter(Boolean)
      .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt) || a.id.localeCompare(b.id));
    if (members.length < 2) continue;

    const label = deriveGroupLabel(members);
    if (!label) continue;

    const sortedIds = members.map((m) => m.id).sort();
    const fingerprint = `${sortedIds.join(',')}::${normalize(label)}`;
    if (dismissed.has(fingerprint)) continue;

    const normLabel = normalize(label);
    const alreadyTaggedAll = members.every((m) =>
      (m.tags || []).some((existingTag) => normalize(existingTag) === normLabel),
    );
    if (alreadyTaggedAll) continue;

    groups.push({
      id: `grp_${sortedIds[0].slice(-6)}_${groups.length + 1}`,
      fingerprint,
      label,
      captureIds: members.map((m) => m.id),
      meanSimilarity: cluster.meanSimilarity,
    });

    for (const member of members) {
      const existingTags = new Set((member.tags || []).map((tag) => normalize(tag)));
      if (existingTags.has(normLabel)) continue;
      const list = suggestedByCapture.get(member.id) || [];
      if (!list.some((item) => normalize(item) === normLabel)) {
        list.push(label);
        suggestedByCapture.set(member.id, list);
      }
    }
  }

  return { groups, suggestedByCapture };
}

export function rebuildSearchText(capture: Pick<CaptureRecord, 'summary' | 'entities' | 'tags' | 'derivedText'>): string {
  return [capture.summary, ...capture.entities, ...(capture.tags || []), capture.derivedText || '']
    .filter(Boolean)
    .join(' ');
}

export type EntityTagState = 'add' | 'tagged' | 'sensitive' | 'unusable';

export interface EntityTagProposal {
  label: string;
  state: EntityTagState;
}

/**
 * Decide whether a detected entity can be promoted to a user tag. The caller
 * still owns the write: this only classifies the label (proposal-only).
 */
export function prepareEntityTag(
  raw: string,
  existingTags: string[],
  capture?: Pick<CaptureRecord, 'summary' | 'derivedText'>,
): EntityTagProposal | null {
  const label = (raw || '').trim().replace(/^#+/, '').trim();
  if (!label) return null;
  if (isSensitiveEntity(label, capture)) return { label, state: 'sensitive' };
  if (label.length > 40 || isSensitiveLabelToken(label, new Set())) {
    return { label, state: 'unusable' };
  }
  const norm = normalize(label);
  if (existingTags.some((tag) => normalize(tag) === norm)) return { label, state: 'tagged' };
  return { label, state: 'add' };
}
