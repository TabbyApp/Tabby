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
  lastSettledAt?: string | null;
  lastSettledAllocations?: { user_id: string; name: string; amount: number }[];
  lastSettledBreakdown?: Record<string, { subtotal: number; tax: number; tip: number }>;
  lastSettledItemsPerUser?: Record<string, { name: string; price: number }[]>;
  supportCode?: string | null;
  cardLastFour?: string | null;
  splitModePreference?: string;
  pendingItemSplit?: { receiptId: string; receiptTotal: number; myAmount: number; draftTipPercentage: number };
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
      const g = groupData as { lastSettledAt?: string | null; lastSettledAllocations?: { user_id: string; name: string; amount: number }[]; lastSettledBreakdown?: Record<string, { subtotal: number; tax: number; tip: number }>; lastSettledItemsPerUser?: Record<string, { name: string; price: number }[]>; supportCode?: string | null; cardLastFour?: string | null; splitModePreference?: string; pendingItemSplit?: { receiptId: string; receiptTotal: number; myAmount: number; draftTipPercentage: number } };
      setCachedGroupDetail(groupId, {
        members: groupData.members,
        createdBy: groupData.created_by,
        inviteToken: groupData.inviteToken,
        receipts,
        lastSettledAt: g.lastSettledAt ?? null,
        lastSettledAllocations: g.lastSettledAllocations,
        lastSettledBreakdown: g.lastSettledBreakdown,
        lastSettledItemsPerUser: g.lastSettledItemsPerUser,
        supportCode: g.supportCode ?? null,
        cardLastFour: groupData.cardLastFour ?? g.cardLastFour ?? null,
        splitModePreference: g.splitModePreference ?? 'item',
        pendingItemSplit: g.pendingItemSplit,
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
      const d = data as { lastSettledAt?: string | null; lastSettledAllocations?: { user_id: string; name: string; amount: number }[]; lastSettledBreakdown?: Record<string, { subtotal: number; tax: number; tip: number }>; lastSettledItemsPerUser?: Record<string, { name: string; price: number }[]>; supportCode?: string | null; cardLastFour?: string | null; splitModePreference?: string };
      setCachedGroupDetail(id, {
        members: data.members,
        createdBy: data.created_by,
        inviteToken: data.inviteToken,
        receipts: data.receipts ?? [],
        lastSettledAt: d.lastSettledAt ?? null,
        lastSettledAllocations: d.lastSettledAllocations,
        lastSettledBreakdown: d.lastSettledBreakdown,
        lastSettledItemsPerUser: d.lastSettledItemsPerUser,
        supportCode: d.supportCode ?? null,
        cardLastFour: data.cardLastFour ?? d.cardLastFour ?? null,
        splitModePreference: d.splitModePreference ?? 'item',
      });
    }
  } catch {
    /* best-effort */
  }
}
