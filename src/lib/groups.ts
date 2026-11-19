/**
 * Local-only editable embedding groups.
 *
 * Pure helpers: no IndexedDB, no Firebase, no capture mutation. Grouping only
 * organises captures — it never writes user tags, never trashes a capture, and
 * never sends anything to Firestore (same privacy boundary as tags).
 */
import type { AppSettings, CaptureRecord, MemoryGroup } from '../types';
import { clusterCaptures, deriveGroupLabel } from './tags';

type GroupThresholds = Pick<
  AppSettings,
  'groupThresholdPhoto' | 'groupThresholdVoice' | 'groupThresholdNote'
>;

function stamp(): string {
  return new Date().toISOString();
}

function newGroupId(seed: string): string {
  return `grp_${seed.slice(-6)}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
}

/**
 * Recompute auto groups while preserving every user-owned group and locked
 * membership. Manual groups and captures with `manualGroupLock` are returned
 * untouched (except for dropped trashed/deleted ids); only unlocked,
 * non-trashed captures take part in clustering.
 */
export function reconcileAutoGroups(
  captures: CaptureRecord[],
  existing: MemoryGroup[],
  thresholds: GroupThresholds,
  uid?: string,
): MemoryGroup[] {
  const locked = new Set<string>();
  for (const group of existing) {
    if (group.source === 'manual') for (const id of group.captureIds) locked.add(id);
  }
  for (const capture of captures) {
    if (capture.manualGroupLock) locked.add(capture.id);
  }

  const byId = new Map(captures.map((c) => [c.id, c]));
  const eligible = captures.filter((c) => c.retentionState !== 'trashed' && !locked.has(c.id));
  const clusters = clusterCaptures(eligible, thresholds);
  const now = stamp();

  const manualGroups: MemoryGroup[] = existing
    .filter((g) => g.source === 'manual')
    .map((g) => ({
      ...g,
      captureIds: g.captureIds.filter((id) => {
        const capture = byId.get(id);
        return Boolean(capture && capture.retentionState !== 'trashed');
      }),
    }))
    .filter((g) => g.captureIds.length > 0);

  const previousAuto = existing.filter((g) => g.source === 'auto');
  const reused = new Set<string>();
  const autoGroups: MemoryGroup[] = clusters.map((cluster, index) => {
    const members = cluster.captureIds
      .map((id) => byId.get(id))
      .filter((c): c is CaptureRecord => Boolean(c));
    const label = deriveGroupLabel(members) || `Group ${index + 1}`;
    const ids = new Set(cluster.captureIds);
    const match = previousAuto.find((g) => !reused.has(g.id) && g.captureIds.some((id) => ids.has(id)));
    if (match) reused.add(match.id);
    return {
      id: match?.id || newGroupId(cluster.captureIds.slice().sort()[0]),
      name: match?.name || label,
      captureIds: cluster.captureIds,
      source: 'auto',
      createdAt: match?.createdAt || now,
      updatedAt: now,
      ...(uid ? { ownerUid: uid } : match?.ownerUid ? { ownerUid: match.ownerUid } : {}),
    };
  });

  return [...manualGroups, ...autoGroups];
}

/** Split selected captures out of a group into a new manual group. */
export function splitGroup(
  group: MemoryGroup,
  selectedIds: string[],
  newName: string,
  uid?: string,
): { source: MemoryGroup; split: MemoryGroup } | null {
  const name = newName.trim();
  const picked = group.captureIds.filter((id) => selectedIds.includes(id));
  if (!name || picked.length === 0 || picked.length === group.captureIds.length) return null;
  const now = stamp();
  const pickedSet = new Set(picked);
  return {
    source: {
      ...group,
      captureIds: group.captureIds.filter((id) => !pickedSet.has(id)),
      source: 'manual',
      updatedAt: now,
    },
    split: {
      id: newGroupId(picked[0]),
      name,
      captureIds: picked,
      source: 'manual',
      createdAt: now,
      updatedAt: now,
      ...(uid ? { ownerUid: uid } : group.ownerUid ? { ownerUid: group.ownerUid } : {}),
    },
  };
}

/** Rename a group. Renaming promotes an auto group to a manual one so the
 * name survives the next recompute. */
export function renameGroup(group: MemoryGroup, newName: string): MemoryGroup | null {
  const name = newName.trim();
  if (!name) return null;
  return { ...group, name, source: 'manual', updatedAt: stamp() };
}

/** Move one capture to another group, or to Ungrouped when target is null.
 * Empty groups are dropped; captures themselves are never deleted. */
export function moveCaptureToGroup(
  groups: MemoryGroup[],
  captureId: string,
  targetGroupId: string | null,
): MemoryGroup[] {
  if (targetGroupId && !groups.some((g) => g.id === targetGroupId)) return groups;
  const next = groups.map((g) => ({
    ...g,
    captureIds: g.captureIds.filter((id) => id !== captureId),
  }));
  if (targetGroupId) {
    const index = next.findIndex((g) => g.id === targetGroupId);
    next[index] = {
      ...next[index],
      captureIds: [...next[index].captureIds, captureId],
      source: 'manual',
      updatedAt: stamp(),
    };
  }
  return next.filter((g) => g.captureIds.length > 0);
}

/** Delete a group record only. Captures are returned to Ungrouped by the
 * caller (which must also clear their manual lock). */
export function removeGroup(groups: MemoryGroup[], groupId: string): MemoryGroup[] {
  return groups.filter((g) => g.id !== groupId);
}
