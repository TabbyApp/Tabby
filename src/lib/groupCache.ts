/**
 * Shared in-memory cache for group detail data.
 * Allows App.tsx to prefetch during splash so GroupDetailPage renders instantly.
 */
import { api } from './api';

export interface CachedGroupDetail {
  members: { id: string; name: string; email: string }[];
  createdBy: string;
  inviteToken: string | null;
  receipts: any[];
  timestamp: number;
}

const cache = new Map<string, CachedGroupDetail>();
const CACHE_TTL = 120_000; // 2 minutes

/** Get cached data if fresh, or null */
export function getCachedGroupDetail(groupId: string): CachedGroupDetail | null {
  const cached = cache.get(groupId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached;
  }
  return null;
}

/** Store group detail data in cache */
export function setCachedGroupDetail(groupId: string, data: Omit<CachedGroupDetail, 'timestamp'>) {
  cache.set(groupId, { ...data, timestamp: Date.now() });
}

/** Invalidate a single group's cache */
export function invalidateGroupCache(groupId: string) {
  cache.delete(groupId);
}

/** Prefetch a single group's details (skips if already cached and fresh) */
export async function prefetchGroupDetail(groupId: string): Promise<void> {
  if (getCachedGroupDetail(groupId)) return;

  try {
    const [groupData, receipts] = await Promise.all([
      api.groups.get(groupId).catch(() => null),
      api.receipts.list(groupId).catch(() => []),
    ]);
    if (groupData) {
      setCachedGroupDetail(groupId, {
        members: groupData.members,
        createdBy: groupData.created_by,
        inviteToken: groupData.inviteToken,
        receipts,
      });
    }
  } catch {
    /* best-effort */
  }
}

/** Prefetch all groups in ONE batch request (avoids N requests + connection queueing) */
export async function prefetchAllGroupDetails(groupIds: string[]): Promise<void> {
  const toFetch = groupIds.filter(id => !getCachedGroupDetail(id));
  if (toFetch.length === 0) return;

  try {
    const batch = await api.groups.getBatch(toFetch);
    for (const [id, data] of Object.entries(batch)) {
      setCachedGroupDetail(id, {
        members: data.members,
        createdBy: data.created_by,
        inviteToken: data.inviteToken,
        receipts: data.receipts ?? [],
      });
    }
  } catch {
    /* best-effort */
  }
}
