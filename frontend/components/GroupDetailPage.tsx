import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Users, Receipt, Trash2, UserMinus, LogOut, Plus, MoreVertical, UserPlus, DollarSign, Check, Copy, Link2, CreditCard } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { PageType } from '../App';
import { BottomNavigation } from './BottomNavigation';
import { ProfileSheet } from './ProfileSheet';
import { useAuth } from '../contexts/AuthContext';
import { api, assetUrl } from '../lib/api';
import { getCachedGroupDetail, setCachedGroupDetail, invalidateGroupCache } from '../lib/groupCache';
import { useReceiptClaimsRealtime } from '../hooks/useReceiptClaimsRealtime';

interface GroupDetailPageProps {
  onNavigate: (page: PageType, groupId?: string) => void;
  theme: 'light' | 'dark';
  groupId: string | null;
  groups: Array<{ id: string; name: string; members: number; balance: number; color: string; createdBy: string }>;
  deleteGroup: (groupId: string) => void;
  leaveGroup: (groupId: string) => void;
  currentUserId: string;
  itemSplitData: { hasSelectedItems: boolean; yourItemsTotal: number; receiptTotal?: number; subtotal?: number };
  setItemSplitData: (data: { hasSelectedItems: boolean; yourItemsTotal: number; receiptTotal?: number; subtotal?: number }) => void;
  receiptData?: { members: Array<{ id: number; name: string; amount: number; avatar: string }>; total: number } | null;
  onStartProcessing?: (transactionId: string) => void;
  onGroupsChanged?: () => void;
  onNavigateToReceiptItems?: (groupId: string, receiptId: string) => void;
  onNavigateToReceiptScan?: (groupId: string, forEvenSplit: boolean) => void;
}

const AVATAR_COLORS = [
  'from-violet-500 to-purple-600',
  'from-pink-500 to-rose-600',
  'from-blue-500 to-indigo-600',
  'from-amber-500 to-orange-600',
  'from-green-500 to-emerald-600',
  'from-teal-500 to-cyan-600',
];

function MemberSelectionsSection({
  receiptDetail,
  realMembers,
  user,
  isDark,
}: {
  receiptDetail: { items: { id: string; name: string; price: number }[]; claims: Record<string, string[]>; members: { id: string; name: string }[] };
  realMembers: { id: string; name: string }[];
  user: { id?: string } | null;
  isDark: boolean;
}) {
  const itemsById = Object.fromEntries(receiptDetail.items.map((i) => [i.id, i]));
  const membersById = Object.fromEntries(receiptDetail.members.map((m) => [m.id, m]));
  const byMember: Record<string, { name: string; items: { name: string; price: number }[]; total: number }> = {};
  for (const [itemId, userIds] of Object.entries(receiptDetail.claims)) {
    const item = itemsById[itemId];
    if (!item) continue;
    const share = item.price / userIds.length;
    for (const uid of userIds) {
      if (!byMember[uid]) byMember[uid] = { name: membersById[uid]?.name ?? 'Unknown', items: [], total: 0 };
      byMember[uid].items.push({ name: item.name, price: share });
      byMember[uid].total += share;
    }
  }
  const entries = Object.entries(byMember);
  if (entries.length === 0) return null;
  return (
    <div className={`mt-6 pt-6 border-t ${isDark ? 'border-slate-600' : 'border-slate-200'}`}>
      <h4 className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'} mb-3`}>Who selected what</h4>
      <div className="space-y-3 text-left">
        {entries.map(([uid, { name, items, total }]) => (
          <div key={uid} className={`rounded-xl p-3 ${isDark ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
            <p className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {uid === user?.id ? 'You' : name}
            </p>
            <ul className={`text-xs mt-1 space-y-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {items.map((it, i) => (
                <li key={i}>{it.name} — ${it.price.toFixed(2)}</li>
              ))}
            </ul>
            <p className={`text-xs font-medium mt-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Subtotal: ${total.toFixed(2)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GroupDetailPage({ onNavigate, theme, groupId, groups, deleteGroup, leaveGroup, currentUserId, itemSplitData, setItemSplitData, receiptData, onStartProcessing, onGroupsChanged, onNavigateToReceiptItems, onNavigateToReceiptScan }: GroupDetailPageProps) {
  const { user, virtualCards } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showRemoveMemberModal, setShowRemoveMemberModal] = useState(false);
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [showMembersDropdown, setShowMembersDropdown] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  
  const [splitMode, setSplitMode] = useState<'even' | 'item'>(receiptData ? 'item' : 'even');
  const [tipPercentage, setTipPercentage] = useState(15);
  const cachedForInit = groupId ? getCachedGroupDetail(groupId) : null;
  const [serverSplitModePreference, setServerSplitModePreference] = useState<string | null>(cachedForInit?.splitModePreference ?? null);
  const [hasReceipt, setHasReceipt] = useState(false);
  const [receiptTotal, setReceiptTotal] = useState(0);
  const [settlingPayment, setSettlingPayment] = useState(false);
  
  const hasSelectedItems = itemSplitData.hasSelectedItems;
  const yourItemsSubtotal = itemSplitData.yourItemsTotal;
  const receiptTotalFromReceipt = itemSplitData.receiptTotal;
  const itemsSubtotal = itemSplitData.subtotal ?? yourItemsSubtotal;
  const tax = (receiptTotalFromReceipt != null && itemsSubtotal > 0 && receiptTotalFromReceipt >= itemsSubtotal)
    ? receiptTotalFromReceipt - itemsSubtotal
    : 0;
  const taxRatio = itemsSubtotal > 0 ? tax / itemsSubtotal : 0;
  const yourTaxShare = yourItemsSubtotal * taxRatio;
  const yourItemsTotal = yourItemsSubtotal + yourTaxShare;
  
  useEffect(() => {
    if (receiptData && receiptData.members.length > 0) {
      setSplitMode('item');
    }
  }, [receiptData]);

  // Sync splitMode from server preference (so all members see host's choice)
  useEffect(() => {
    if (serverSplitModePreference && !receiptData) {
      setSplitMode(serverSplitModePreference as 'even' | 'item');
    }
  }, [serverSplitModePreference, receiptData]);
  
  const isDark = theme === 'dark';

  const currentGroup = groups.find(g => g.id === groupId);

  // Use shared prefetch cache - data may already be available from App.tsx prefetch
  const cached = groupId ? getCachedGroupDetail(groupId) : null;

  const [realMembers, setRealMembers] = useState<{ id: string; name: string; email: string; avatarUrl?: string }[]>(
    cached?.members ?? []
  );
  const [realCreatedBy, setRealCreatedBy] = useState<string>(
    cached?.createdBy ?? ''
  );
  const [realReceipts, setRealReceipts] = useState<any[]>(
    cached?.receipts ?? []
  );
  const [inviteToken, setInviteToken] = useState<string | null>(
    cached?.inviteToken ?? null
  );
  const [lastSettledAt, setLastSettledAt] = useState<string | null>(null);
  const [lastSettledAllocations, setLastSettledAllocations] = useState<{ user_id: string; name: string; amount: number }[]>([]);
  const [lastSettledBreakdown, setLastSettledBreakdown] = useState<Record<string, { subtotal: number; tax: number; tip: number }> | null>(null);
  const [lastSettledItemsPerUser, setLastSettledItemsPerUser] = useState<Record<string, { name: string; price: number }[]> | null>(null);
  const [supportCode, setSupportCode] = useState<string | null>(null);
  const [cardLastFour, setCardLastFour] = useState<string | null>(null);
  const [receiptDetail, setReceiptDetail] = useState<{ items: { id: string; name: string; price: number }[]; claims: Record<string, string[]>; members: { id: string; name: string }[] } | null>(null);

  const latestPendingReceipt = realReceipts.find((r: any) => r.status === 'pending');
  const hasPendingReceipt = !!latestPendingReceipt;
  // After item-split confirm, receipt becomes 'completed' so use latest completed receipt without transaction for Edit
  const latestCompletedReceiptNoTx = realReceipts.find((r: any) => r.status === 'completed' && !r.transaction_id);
  const receiptForItemSplit = latestPendingReceipt ?? latestCompletedReceiptNoTx;

  // Track which groupId we've loaded for, to avoid double-fetching
  const loadedGroupRef = useRef<string | null>(null);

  useEffect(() => {
    if (!groupId) return;
    // If we have fresh cached data from prefetch, use it and skip the API call
    const freshCache = getCachedGroupDetail(groupId);
    if (freshCache && loadedGroupRef.current === groupId) return;
    
    // Apply cache immediately if available (before API returns)
    if (freshCache) {
      setRealMembers(freshCache.members);
      setRealCreatedBy(freshCache.createdBy);
      setInviteToken(freshCache.inviteToken);
      setRealReceipts(freshCache.receipts);
      setLastSettledAt(freshCache.lastSettledAt ?? null);
      setLastSettledAllocations(freshCache.lastSettledAllocations ?? []);
      setLastSettledBreakdown((freshCache as { lastSettledBreakdown?: Record<string, { subtotal: number; tax: number; tip: number }> }).lastSettledBreakdown ?? null);
      setLastSettledItemsPerUser((freshCache as { lastSettledItemsPerUser?: Record<string, { name: string; price: number }[]> }).lastSettledItemsPerUser ?? null);
      setSupportCode(freshCache.supportCode ?? null);
      setCardLastFour(freshCache.cardLastFour ?? null);
      setServerSplitModePreference(freshCache.splitModePreference ?? null);
      const latestCached = freshCache.receipts.find((r: any) => r.total != null);
      if (latestCached?.total) {
        setReceiptTotal(latestCached.total);
        setHasReceipt(true);
      }
      loadedGroupRef.current = groupId;
      return; // Cache is fresh, no need to refetch
    }

    loadedGroupRef.current = groupId;

    // No cache - fetch both in parallel
    Promise.all([
      api.groups.get(groupId).catch(() => null),
      api.receipts.list(groupId).catch(() => [] as any[]),
    ]).then(([groupData, receiptsData]) => {
      if (groupData) {
        setRealMembers(groupData.members);
        setRealCreatedBy(groupData.created_by);
        setInviteToken(groupData.inviteToken);
        setLastSettledAt((groupData as { lastSettledAt?: string | null }).lastSettledAt ?? null);
        setLastSettledAllocations((groupData as { lastSettledAllocations?: { user_id: string; name: string; amount: number }[] }).lastSettledAllocations ?? []);
        setLastSettledBreakdown((groupData as { lastSettledBreakdown?: Record<string, { subtotal: number; tax: number; tip: number }> }).lastSettledBreakdown ?? null);
        setLastSettledItemsPerUser((groupData as { lastSettledItemsPerUser?: Record<string, { name: string; price: number }[]> }).lastSettledItemsPerUser ?? null);
        setSupportCode((groupData as { supportCode?: string | null }).supportCode ?? null);
        setCardLastFour(groupData.cardLastFour ?? null);
        setServerSplitModePreference((groupData as { splitModePreference?: string }).splitModePreference ?? null);
      }
      const receipts = receiptsData ?? [];
      setRealReceipts(receipts);
      const latest = receipts.find((r: any) => r.total != null);
      if (latest && latest.total) {
        setReceiptTotal(latest.total);
        setHasReceipt(true);
      }
      // Store in shared cache
      if (groupData) {
        const g = groupData as { lastSettledAt?: string | null; lastSettledAllocations?: { user_id: string; name: string; amount: number }[]; lastSettledBreakdown?: Record<string, { subtotal: number; tax: number; tip: number }>; lastSettledItemsPerUser?: Record<string, { name: string; price: number }[]>; supportCode?: string | null; cardLastFour?: string | null; splitModePreference?: string };
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
        });
      }
    });
  }, [groupId]);

  // If view-only but breakdown missing (e.g. from batch cache), refetch once to get full settlement breakdown
  useEffect(() => {
    if (!groupId || !lastSettledAt || lastSettledAllocations.length === 0) return;
    if (lastSettledBreakdown != null) return;
    api.groups.get(groupId).then((groupData) => {
      const g = groupData as { lastSettledBreakdown?: Record<string, { subtotal: number; tax: number; tip: number }>; lastSettledItemsPerUser?: Record<string, { name: string; price: number }[]> };
      if (g.lastSettledBreakdown) setLastSettledBreakdown(g.lastSettledBreakdown);
      if (g.lastSettledItemsPerUser) setLastSettledItemsPerUser(g.lastSettledItemsPerUser);
    }).catch(() => {});
  }, [groupId, lastSettledAt, lastSettledAllocations.length, lastSettledBreakdown]);

  // Poll for group + receipts so other members see new uploads (e.g. pending receipt for item split)
  useEffect(() => {
    if (!groupId) return;
    const interval = setInterval(() => {
      Promise.all([
        api.groups.get(groupId).catch(() => null),
        api.receipts.list(groupId).catch(() => [] as any[]),
      ]).then(([groupData, receiptsData]) => {
        if (groupData) {
          setServerSplitModePreference((groupData as { splitModePreference?: string }).splitModePreference ?? null);
        }
        const receipts = receiptsData ?? [];
        setRealReceipts(receipts);
        const latest = receipts.find((r: any) => r.total != null);
        if (latest?.total) {
          setReceiptTotal(latest.total);
          setHasReceipt(true);
        }
        if (groupData) {
          const g = groupData as { lastSettledAt?: string | null; lastSettledAllocations?: { user_id: string; name: string; amount: number }[]; lastSettledBreakdown?: Record<string, { subtotal: number; tax: number; tip: number }>; lastSettledItemsPerUser?: Record<string, { name: string; price: number }[]>; supportCode?: string | null; cardLastFour?: string | null; splitModePreference?: string };
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
          });
        }
      });
    }, 10000); // every 10 seconds so other members see new receipt within ~10s
    return () => clearInterval(interval);
  }, [groupId]);

  const refetchReceiptDetail = useCallback(() => {
    if (!latestPendingReceipt?.id) return;
    api.receipts.get(latestPendingReceipt.id).then((data: any) => {
      setReceiptDetail({ items: data.items ?? [], claims: data.claims ?? {}, members: data.members ?? [] });
    }).catch(() => setReceiptDetail(null));
  }, [latestPendingReceipt?.id]);

  useReceiptClaimsRealtime(latestPendingReceipt?.id ?? null, refetchReceiptDetail);

  // Fetch receipt detail (items + claims) for pending receipt to show member selections
  useEffect(() => {
    if (!latestPendingReceipt?.id || !groupId) {
      setReceiptDetail(null);
      return;
    }
    api.receipts.get(latestPendingReceipt.id).then((data: any) => {
      setReceiptDetail({ items: data.items ?? [], claims: data.claims ?? {}, members: data.members ?? [] });
    }).catch(() => setReceiptDetail(null));
  }, [latestPendingReceipt?.id, groupId]);

  const isCreator = realCreatedBy ? realCreatedBy === user?.id : currentGroup?.createdBy === currentUserId;
  // When pending receipt exists, non-hosts are locked to item split; host can always choose
  const splitModeLocked = hasPendingReceipt && !isCreator;
  const effectiveSplitMode = splitModeLocked ? 'item' : splitMode;

  // Post-purchase view-only: when transaction was settled, show confirmation (no add receipt)
  const isViewOnly = !!lastSettledAt;

  // Build member avatars from real data
  const memberAvatars = realMembers.length > 0
    ? realMembers.map((m, i) => {
        const isMe = m.id === user?.id;
        const initials = isMe ? 'ME' : (m.name.charAt(0) + (m.name.split(' ')[1]?.charAt(0) || '')).toUpperCase();
        return {
          id: i + 1,
          name: isMe ? 'You' : m.name,
          initials,
          color: AVATAR_COLORS[i % AVATAR_COLORS.length],
          _realId: m.id,
          avatarUrl: m.avatarUrl ?? (isMe ? (user as { avatarUrl?: string })?.avatarUrl : undefined),
        };
      })
    : [{ id: 1, name: 'You', initials: 'ME', color: AVATAR_COLORS[0], _realId: user?.id ?? '', avatarUrl: (user as { avatarUrl?: string })?.avatarUrl }];

  const visibleAvatars = memberAvatars.slice(0, 3);
  const remainingCount = Math.max(0, memberAvatars.length - 3);

  const billBeforeTipForYou = effectiveSplitMode === 'even' ? receiptTotal : yourItemsTotal;
  const tipAmount = billBeforeTipForYou * tipPercentage / 100;
  
  const totalWithTip = effectiveSplitMode === 'even'
    ? receiptTotal + tipAmount
    : yourItemsTotal + tipAmount;
  const yourShare = effectiveSplitMode === 'even'
    ? (memberAvatars.length > 0 ? totalWithTip / memberAvatars.length : totalWithTip)
    : totalWithTip;

  const baseGroup = {
    id: groupId ?? '',
    name: currentGroup?.name ?? 'Group',
    balance: currentGroup?.balance ?? 0,
    yourBalance: 0,
    transactions: realReceipts.map((r, i) => ({
      id: i + 1,
      description: `Receipt ${i + 1}`,
      amount: r.total ?? 0,
      date: (() => {
        const d = new Date(r.created_at);
        const diffH = Math.floor((Date.now() - d.getTime()) / 3600000);
        return diffH < 1 ? 'just now' : diffH < 24 ? `${diffH}h ago` : `${Math.floor(diffH / 24)}d ago`;
      })(),
      type: 'expense',
      receipts: 1,
    })),
  };

  const [removedMembers, setRemovedMembers] = useState<number[]>([]);

  const handleRemoveMember = (member: any) => {
    setSelectedMember(member);
    setShowRemoveMemberModal(true);
    setShowMenu(false);
  };

  const confirmRemoveMember = () => {
    if (selectedMember) {
      setRemovedMembers([...removedMembers, selectedMember.id]);
      if (groupId && selectedMember._realId) {
        if (groupId) invalidateGroupCache(groupId);
        api.groups.removeMember(groupId, selectedMember._realId)
          .then(() => onGroupsChanged?.())
          .catch(() => {});
      }
      setShowRemoveMemberModal(false);
      setSelectedMember(null);
    }
  };

  const handleDeleteGroup = () => {
    if (groupId) {
      deleteGroup(groupId);
    }
    setShowDeleteModal(false);
    setTimeout(() => {
      onNavigate('groups');
    }, 100);
  };

  const handleLeaveGroup = () => {
    if (groupId) {
      leaveGroup(groupId);
    }
    setShowLeaveModal(false);
    setTimeout(() => {
      onNavigate('groups');
    }, 100);
  };

  const handleAddReceipt = () => {
    if (!groupId || !isCreator) return;
    onNavigateToReceiptScan?.(groupId, splitMode === 'even');
  };

  const handleSplitModeChange = (mode: 'even' | 'item') => {
    setSplitMode(mode);
    if (groupId && isCreator) {
      api.groups.updateSplitModePreference(groupId, mode).then(() => {
        setServerSplitModePreference(mode);
        invalidateGroupCache(groupId);
        onGroupsChanged?.();
      }).catch(() => {});
    }
  };

  const handleCompletePayment = async () => {
    if (!groupId || settlingPayment) return;
    setSettlingPayment(true);
    try {
      // Create a transaction on the backend. For item split, link the existing completed receipt.
      const splitModeApi = effectiveSplitMode === 'even' ? 'EVEN_SPLIT' : 'FULL_CONTROL';
      const receiptIdForTx = effectiveSplitMode === 'item' ? receiptForItemSplit?.id : undefined;
      const tx = await api.transactions.create(groupId, splitModeApi, receiptIdForTx);
      
      // Set tip: host's percentage (e.g. 15%) applies to the full bill, so everyone pays 15% of their amount
      const fullBillBeforeTip = receiptTotal > 0 ? receiptTotal : (effectiveSplitMode === 'item' ? (receiptTotalFromReceipt ?? 0) : 0);
      if (tipPercentage > 0 && fullBillBeforeTip > 0) {
        const totalTipAmount = fullBillBeforeTip * tipPercentage / 100;
        await api.transactions.setTip(tx.id, totalTipAmount);
      }
      
      // If even split with a known subtotal, set it
      if (effectiveSplitMode === 'even' && receiptTotal > 0) {
        await api.transactions.setSubtotal(tx.id, receiptTotal).catch(() => {});
      }
      
      // Finalize the transaction
      await api.transactions.finalize(tx.id);
      
      // Notify parent about the transaction
      onStartProcessing?.(tx.id);
      
      // Navigate to processing page
      onNavigate('processing', groupId);
    } catch (err) {
      console.error('Payment failed:', err);
      // Still navigate to processing for UX
      onNavigate('processing', groupId);
    } finally {
      setSettlingPayment(false);
    }
  };

  const inviteLink = inviteToken 
    ? `${window.location.origin}/join/${inviteToken}`
    : '';

  const handleCopyInviteLink = () => {
    if (!inviteLink) return;
    navigator.clipboard?.writeText(inviteLink).catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = inviteLink;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <div className={`h-[calc(100vh-48px-24px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50'}`}>
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.12 }}
        className={`${isDark ? 'bg-slate-800/95 border-slate-700' : 'bg-white/95 border-slate-200'} backdrop-blur-xl border-b px-5 py-4`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => onNavigate('groups')}
              className={`w-10 h-10 rounded-[14px] ${isDark ? 'bg-slate-700/80' : 'bg-gradient-to-br from-purple-100 to-indigo-100'} flex items-center justify-center active:scale-95 transition-transform`}
            >
              <ChevronLeft size={20} className={isDark ? 'text-white' : 'text-purple-600'} strokeWidth={2.5} />
            </button>
            <div>
              <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {baseGroup.name}
              </h1>
            </div>
          </div>
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className={`w-10 h-10 rounded-[14px] ${isDark ? 'bg-slate-700/80' : 'bg-gradient-to-br from-purple-100 to-indigo-100'} flex items-center justify-center active:scale-95 transition-transform relative`}
          >
            <MoreVertical size={18} className={isDark ? 'text-white' : 'text-purple-600'} />
          </button>
          
          {/* Dropdown Menu */}
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`absolute right-5 top-20 w-56 ${isDark ? 'bg-slate-800' : 'bg-white'} rounded-2xl shadow-2xl overflow-hidden z-20 border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}
              >
                {!isCreator && (
                  <button 
                    onClick={() => { setShowLeaveModal(true); setShowMenu(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 ${isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-50'} transition-colors border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}
                  >
                    <LogOut size={18} className="text-orange-500" />
                    <span className="text-sm font-medium text-orange-500">Leave Group</span>
                  </button>
                )}
                {isCreator && (
                  <button 
                    onClick={() => { setShowDeleteModal(true); setShowMenu(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 ${isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-50'} transition-colors`}
                  >
                    <Trash2 size={18} className="text-red-500" />
                    <span className="text-sm font-medium text-red-500">Delete Group</span>
                  </button>
                )}
              </motion.div>
            </>
          )}
        </div>

        {/* Support code for support tickets */}
        {supportCode && (
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mt-2`}>
            Support ID: <span className="font-mono font-semibold">{supportCode}</span>
          </p>
        )}

        {/* Virtual card - links to card details */}
        {(cardLastFour || virtualCards.some(c => c.groupId === groupId)) && (
          <button
            onClick={() => onNavigate('cardDetails', groupId ?? undefined)}
            className={`w-full mt-3 rounded-2xl p-4 flex items-center justify-between ${isDark ? 'bg-slate-700/80' : 'bg-gradient-to-br from-purple-100 to-indigo-100'} active:scale-[0.99] transition-transform`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isDark ? 'bg-slate-600' : 'bg-white/80'}`}>
                <CreditCard size={24} className={isDark ? 'text-white' : 'text-purple-600'} />
              </div>
              <div className="text-left">
                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Virtual Group Card</p>
                <p className={`text-xs font-mono ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  •••• •••• •••• {cardLastFour ?? virtualCards.find(c => c.groupId === groupId)?.cardLastFour ?? '----'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Balance</p>
              <p className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                ${(virtualCards.find(c => c.groupId === groupId)?.groupTotal ?? 0).toFixed(2)}
              </p>
            </div>
          </button>
        )}

        {/* Split Mode Toggle - hidden when view-only or when pending receipt (locked to item split) */}
        {!isViewOnly && !splitModeLocked && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.12 }}
          className={`${isDark ? 'bg-slate-700/50' : 'bg-slate-100/80'} rounded-[16px] p-1 flex gap-1`}
        >
          <button
            onClick={() => handleSplitModeChange('even')}
            className={`flex-1 py-2.5 rounded-[12px] font-semibold text-[15px] transition-all ${
              splitMode === 'even'
                ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-purple-500/30'
                : `${isDark ? 'text-slate-400' : 'text-slate-600'}`
            }`}
          >
            Split Evenly
          </button>
          <button
            onClick={() => handleSplitModeChange('item')}
            className={`flex-1 py-2.5 rounded-[12px] font-semibold text-[15px] transition-all ${
              splitMode === 'item'
                ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-purple-500/30'
                : `${isDark ? 'text-slate-400' : 'text-slate-600'}`
            }`}
          >
            Item Split
          </button>
        </motion.div>
        )}
      </motion.div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-5 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]">
        {/* Post-purchase confirmation (view-only) */}
        {isViewOnly && (
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={`${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-100'} rounded-[24px] p-6 shadow-lg border mb-5`}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <Check size={24} className="text-green-600" />
              </div>
              <div>
                <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Payment Complete</h3>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Everyone has been charged</p>
              </div>
            </div>
            <h4 className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'} mb-3`}>What each person paid</h4>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mb-3`}>Tip is split by the host’s choice; tax is proportional to what you ordered.</p>
            <div className="space-y-4">
              {lastSettledAllocations.map((a) => {
                const breakdown = lastSettledBreakdown?.[a.user_id];
                const items = lastSettledItemsPerUser?.[a.user_id];
                return (
                  <div key={a.user_id} className={`rounded-xl p-4 ${isDark ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>{a.name}</span>
                      <span className="font-bold text-green-600">${a.amount.toFixed(2)}</span>
                    </div>
                    {breakdown && (
                      <div className={`text-xs space-y-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        <div className="flex justify-between">
                          <span>Items</span>
                          <span>${breakdown.subtotal.toFixed(2)}</span>
                        </div>
                        {(breakdown.tax ?? 0) > 0 && (
                          <div className="flex justify-between">
                            <span>Tax (proportional)</span>
                            <span>${breakdown.tax.toFixed(2)}</span>
                          </div>
                        )}
                        {(breakdown.tip ?? 0) > 0 && (
                          <div className="flex justify-between">
                            <span>Tip</span>
                            <span>${breakdown.tip.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {items && items.length > 0 && (
                      <div className={`mt-2 pt-2 border-t ${isDark ? 'border-slate-600' : 'border-slate-200'}`}>
                        <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'} mb-1`}>Selected items</p>
                        <ul className={`text-xs space-y-0.5 ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
                          {items.map((it, i) => (
                            <li key={i} className="flex justify-between">
                              <span className="truncate pr-2">{it.name}</span>
                              <span>${it.price.toFixed(2)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Members with Invite Button */}
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-100'} rounded-[20px] p-4 shadow-lg ${isDark ? 'shadow-none' : 'shadow-slate-200/50'} border mb-5 relative`}
        >
          <div className="flex items-center justify-between">
            <button 
              onClick={() => setShowMembersDropdown(!showMembersDropdown)}
              className="flex items-center gap-3 active:scale-95 transition-transform"
            >
              <div className="flex items-center">
                {visibleAvatars.map((avatar, index) => (
                  <div
                    key={avatar.id}
                    className={`w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br ${avatar.color} flex items-center justify-center text-white text-xs font-bold shadow-lg border-2 ${isDark ? 'border-slate-800' : 'border-white'}`}
                    style={{ marginLeft: index > 0 ? '-12px' : '0', zIndex: visibleAvatars.length - index }}
                  >
                    {avatar.avatarUrl ? (
                      <img src={assetUrl(avatar.avatarUrl)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      avatar.initials
                    )}
                  </div>
                ))}
                {remainingCount > 0 && (
                  <div
                    className={`w-10 h-10 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'} flex items-center justify-center text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'} shadow-lg border-2 ${isDark ? 'border-slate-800' : 'border-white'}`}
                    style={{ marginLeft: '-12px', zIndex: 0 }}
                  >
                    +{remainingCount}
                  </div>
                )}
              </div>
              <div>
                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {memberAvatars.length} members
                </p>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  in this group
                </p>
              </div>
            </button>
            {!isViewOnly && (
            <button 
              onClick={() => setShowInviteSheet(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold text-sm shadow-lg shadow-purple-500/30 active:scale-95 transition-transform"
            >
              <UserPlus size={16} strokeWidth={2.5} />
              Invite
            </button>
            )}
          </div>

          {/* Members Dropdown */}
          <AnimatePresence>
            {showMembersDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-30" 
                  onClick={() => setShowMembersDropdown(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className={`absolute left-4 right-4 top-[calc(100%+8px)] ${isDark ? 'bg-slate-800' : 'bg-white'} rounded-2xl shadow-2xl overflow-hidden z-40 border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}
                >
                  <div className={`px-4 py-3 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                    <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      All Members ({memberAvatars.length})
                    </p>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {memberAvatars.map((member) => {
                      const isMe = member._realId === user?.id;
                      const isMemberCreator = member._realId === realCreatedBy;
                      return (
                        <div
                          key={member.id}
                          className={`flex items-center gap-3 px-4 py-3 ${isDark ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'} transition-colors border-b ${isDark ? 'border-slate-700/50' : 'border-gray-100'} last:border-0`}
                        >
                          <div
                            className={`w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br ${member.color} flex items-center justify-center text-white text-xs font-bold shadow-md`}
                          >
                            {member.avatarUrl ? (
                              <img src={assetUrl(member.avatarUrl)} alt="" className="w-full h-full object-cover" />
                            ) : (
                              member.initials
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'} text-sm truncate`}>
                              {member.name}
                            </p>
                            {isMe && (
                              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>You</p>
                            )}
                            {isMemberCreator && (
                              <p className="text-xs text-violet-500 font-medium">Group Creator</p>
                            )}
                          </div>
                          {isCreator && !isMe && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveMember(member);
                                setShowMembersDropdown(false);
                              }}
                              className="text-red-500 text-xs font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Split Evenly Mode - hidden when view-only */}
        {!isViewOnly && (
        <AnimatePresence mode="wait">
          {effectiveSplitMode === 'even' && (
            <motion.div
              key="even"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.15 }}
            >
              {!hasReceipt ? (
                <motion.div
                  initial={{ y: 8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.15 }}
                  className={`${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-100'} rounded-[24px] p-8 shadow-lg ${isDark ? 'shadow-none' : 'shadow-slate-200/50'} border text-center`}
                >
                  <div className={`w-16 h-16 rounded-full ${isDark ? 'bg-slate-700' : 'bg-purple-100'} flex items-center justify-center mx-auto mb-4`}>
                    <Receipt size={28} className="text-purple-600" />
                  </div>
                  <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'} mb-2`}>
                    {isCreator ? 'Add a Receipt' : 'Waiting for Receipt'}
                  </h3>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'} mb-6`}>
                    {isCreator ? 'Upload your receipt to split the bill evenly among all members' : 'Only the group host can add a receipt'}
                  </p>
                  {isCreator && (
                    <button
                      onClick={handleAddReceipt}
                      className="w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white py-3.5 rounded-[16px] font-bold shadow-xl shadow-purple-500/30 active:scale-[0.98] transition-transform"
                    >
                      Add Receipt
                    </button>
                  )}
                </motion.div>
              ) : (
                <>
                  {/* Receipt Summary */}
                  <motion.div
                    initial={{ y: 6, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.12 }}
                    className={`${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-100'} rounded-[24px] p-5 shadow-lg ${isDark ? 'shadow-none' : 'shadow-slate-200/50'} border mb-5`}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                        <Receipt size={24} className="text-white" />
                      </div>
                      <div className="flex-1">
                        <p className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'} text-lg`}>Receipt Added</p>
                        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Bill will be split evenly</p>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                        <Check size={18} className="text-green-600" strokeWidth={3} />
                      </div>
                    </div>

                    <div className={`${isDark ? 'bg-slate-700/50' : 'bg-slate-50'} rounded-[16px] p-4 space-y-2`}>
                      <div className="flex justify-between items-center">
                        <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Subtotal</span>
                        <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>${receiptTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Tip ({tipPercentage}%)</span>
                        <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>${tipAmount.toFixed(2)}</span>
                      </div>
                      <div className={`border-t ${isDark ? 'border-slate-600' : 'border-slate-200'} pt-2 mt-2`}>
                        <div className="flex justify-between items-center">
                          <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Total</span>
                          <span className={`font-bold text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>${totalWithTip.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className={`${isDark ? 'bg-purple-900/30' : 'bg-purple-50'} rounded-xl p-3 mt-3`}>
                        <div className="flex justify-between items-center">
                          <span className={`text-sm font-semibold ${isDark ? 'text-purple-300' : 'text-purple-900'}`}>Your Share</span>
                          <span className={`font-bold text-xl ${isDark ? 'text-purple-300' : 'text-purple-600'}`}>${yourShare.toFixed(2)}</span>
                        </div>
                        <p className={`text-xs ${isDark ? 'text-purple-400' : 'text-purple-600'} mt-1`}>
                          Split among {memberAvatars.length} members
                        </p>
                      </div>
                    </div>
                  </motion.div>

                  {/* Tip Slider */}
                  <motion.div
                    initial={{ y: 6, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.12 }}
                    className={`${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-100'} rounded-[24px] p-5 shadow-lg ${isDark ? 'shadow-none' : 'shadow-slate-200/50'} border mb-5`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <DollarSign size={20} className="text-amber-500" />
                        <h3 className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Add Tip</h3>
                      </div>
                      <span className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                        {tipPercentage}%
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      {[10, 15, 18, 20].map((tip) => (
                        <button
                          key={tip}
                          onClick={() => setTipPercentage(tip)}
                          className={`py-2.5 rounded-[12px] font-semibold text-sm transition-all ${
                            tipPercentage === tip
                              ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-purple-500/30'
                              : `${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-700'}`
                          }`}
                        >
                          {tip}%
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                      <input
                        type="range" min="0" max="30" value={tipPercentage}
                        onChange={(e) => setTipPercentage(parseInt(e.target.value))}
                        className="w-full h-2 rounded-full appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, rgb(139, 92, 246) 0%, rgb(168, 85, 247) ${(tipPercentage / 30) * 100}%, ${isDark ? 'rgb(51, 65, 85)' : 'rgb(226, 232, 240)'} ${(tipPercentage / 30) * 100}%, ${isDark ? 'rgb(51, 65, 85)' : 'rgb(226, 232, 240)'} 100%)`
                        }}
                      />
                      <div className="flex justify-between mt-2">
                        <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>0%</span>
                        <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>30%</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* Complete Payment Button */}
                  <motion.button
                    initial={{ y: 6, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.12 }}
                    onClick={handleCompletePayment}
                    disabled={settlingPayment}
                    className="w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white py-4 rounded-[20px] font-bold shadow-2xl shadow-purple-500/50 active:scale-[0.98] transition-transform text-[17px] disabled:opacity-60"
                  >
                    {settlingPayment ? 'Processing...' : `Complete Payment • $${yourShare.toFixed(2)}`}
                  </motion.button>
                </>
              )}
            </motion.div>
          )}

          {/* Item Split Mode */}
          {effectiveSplitMode === 'item' && (
            <motion.div
              key="item"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >
              {hasSelectedItems ? (
                <>
                  {/* Selected Items Summary + Tip + Complete (show after item-split confirm even though receipt is now 'completed') */}
                  <motion.div
                    initial={{ y: 6, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.12 }}
                    className={`${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-100'} rounded-[24px] p-5 shadow-lg ${isDark ? 'shadow-none' : 'shadow-slate-200/50'} border mb-5`}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg">
                        <Receipt size={24} className="text-white" />
                      </div>
                      <div className="flex-1">
                        <p className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'} text-lg`}>Items Selected</p>
                        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Your items from receipt</p>
                      </div>
                      {receiptForItemSplit && (
                        <button
                          onClick={() => groupId && onNavigateToReceiptItems?.(groupId, receiptForItemSplit.id)}
                          className="text-violet-600 font-semibold text-sm"
                        >
                          Edit
                        </button>
                      )}
                    </div>

                    <div className={`${isDark ? 'bg-slate-700/50' : 'bg-slate-50'} rounded-[16px] p-4 space-y-2`}>
                      <div className="flex justify-between items-center">
                        <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Your Items</span>
                        <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>${yourItemsSubtotal.toFixed(2)}</span>
                      </div>
                      {yourTaxShare > 0 && (
                        <div className="flex justify-between items-center">
                          <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Tax</span>
                          <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>${yourTaxShare.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Tip ({tipPercentage}%)</span>
                        <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>${tipAmount.toFixed(2)}</span>
                      </div>
                      <div className={`border-t ${isDark ? 'border-slate-600' : 'border-slate-200'} pt-2 mt-2`}>
                        <div className="flex justify-between items-center">
                          <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Your Total</span>
                          <span className={`font-bold text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>${totalWithTip.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Tip Slider - Item Split */}
                  <motion.div
                    initial={{ y: 6, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.12 }}
                    className={`${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-100'} rounded-[24px] p-5 shadow-lg ${isDark ? 'shadow-none' : 'shadow-slate-200/50'} border mb-5`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <DollarSign size={20} className="text-amber-500" />
                        <h3 className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Add Tip</h3>
                      </div>
                      <span className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                        {tipPercentage}%
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      {[10, 15, 18, 20].map((tip) => (
                        <button
                          key={tip}
                          onClick={() => setTipPercentage(tip)}
                          className={`py-2.5 rounded-[12px] font-semibold text-sm transition-all ${
                            tipPercentage === tip
                              ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-purple-500/30'
                              : `${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-700'}`
                          }`}
                        >
                          {tip}%
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                      <input
                        type="range" min="0" max="30" value={tipPercentage}
                        onChange={(e) => setTipPercentage(parseInt(e.target.value))}
                        className="w-full h-2 rounded-full appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, rgb(139, 92, 246) 0%, rgb(168, 85, 247) ${(tipPercentage / 30) * 100}%, ${isDark ? 'rgb(51, 65, 85)' : 'rgb(226, 232, 240)'} ${(tipPercentage / 30) * 100}%, ${isDark ? 'rgb(51, 65, 85)' : 'rgb(226, 232, 240)'} 100%)`
                        }}
                      />
                      <div className="flex justify-between mt-2">
                        <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>0%</span>
                        <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>30%</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* Complete Payment Button - Item Split */}
                  <motion.button
                    initial={{ y: 6, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.12 }}
                    onClick={handleCompletePayment}
                    disabled={settlingPayment}
                    className="w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white py-4 rounded-[20px] font-bold shadow-2xl shadow-purple-500/50 active:scale-[0.98] transition-transform text-[17px] disabled:opacity-60"
                  >
                    {settlingPayment ? 'Processing...' : `Complete Payment • $${totalWithTip.toFixed(2)}`}
                  </motion.button>
                </>
              ) : hasPendingReceipt ? (
                <motion.div
                  initial={{ y: 8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.15 }}
                  className={`${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-100'} rounded-[24px] p-8 shadow-lg ${isDark ? 'shadow-none' : 'shadow-slate-200/50'} border text-center`}
                >
                  <div className={`w-16 h-16 rounded-full ${isDark ? 'bg-slate-700' : 'bg-indigo-100'} flex items-center justify-center mx-auto mb-4`}>
                    <Receipt size={28} className="text-indigo-600" />
                  </div>
                  <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'} mb-2`}>Select Your Items</h3>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'} mb-6`}>
                    A receipt has been uploaded. Choose what you ordered to split by item.
                  </p>
                  <button
                    onClick={() => groupId && latestPendingReceipt && onNavigateToReceiptItems?.(groupId, latestPendingReceipt.id)}
                    className="w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white py-3.5 rounded-[16px] font-bold shadow-xl shadow-purple-500/30 active:scale-[0.98] transition-transform"
                  >
                    Select Your Items
                  </button>
                  {receiptDetail && receiptDetail.items.length > 0 && (
                    <MemberSelectionsSection receiptDetail={receiptDetail} realMembers={realMembers} user={user} isDark={isDark} />
                  )}
                </motion.div>
              ) : (
                <motion.div
                  initial={{ y: 8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.15 }}
                  className={`${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-100'} rounded-[24px] p-8 shadow-lg ${isDark ? 'shadow-none' : 'shadow-slate-200/50'} border text-center`}
                >
                  <div className={`w-16 h-16 rounded-full ${isDark ? 'bg-slate-700' : 'bg-indigo-100'} flex items-center justify-center mx-auto mb-4`}>
                    <Receipt size={28} className="text-indigo-600" />
                  </div>
                  <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'} mb-2`}>
                    {isCreator ? 'Upload a Receipt' : 'Waiting for Receipt'}
                  </h3>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'} mb-6`}>
                    {isCreator ? 'Upload your receipt and choose what you ordered to split by item' : 'The group creator needs to upload a receipt first'}
                  </p>
                  {isCreator && (
                    <button
                      onClick={handleAddReceipt}
                      className="w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white py-3.5 rounded-[16px] font-bold shadow-xl shadow-purple-500/30 active:scale-[0.98] transition-transform"
                    >
                      Scan Receipt
                    </button>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        )}

        {/* Transaction History */}
        {baseGroup.transactions.length > 0 && (
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.15 }}
            className="mt-6"
          >
            <h2 className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'} uppercase tracking-wider mb-3 px-1`}>
              Recent Activity
            </h2>
            <div className="space-y-3">
              {baseGroup.transactions.map((transaction, index) => (
                <motion.div
                  key={transaction.id}
                  initial={{ x: -6, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.02, duration: 0.12 }}
                  className={`${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-100'} rounded-[18px] p-4 shadow-lg ${isDark ? 'shadow-none' : 'shadow-slate-200/50'} border`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-[12px] flex items-center justify-center ${
                        transaction.type === 'expense' ? 'bg-red-100' : 'bg-green-100'
                      }`}>
                        <Receipt size={20} className={transaction.type === 'expense' ? 'text-red-500' : 'text-green-500'} />
                      </div>
                      <div>
                        <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{transaction.description}</p>
                        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{transaction.date}</p>
                      </div>
                    </div>
                    <p className={`font-bold ${transaction.type === 'expense' ? 'text-red-500' : 'text-green-500'}`}>
                      {transaction.type === 'expense' ? '-' : '+'}${transaction.amount.toFixed(2)}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="groupDetail" onNavigate={onNavigate} onProfileClick={() => setShowProfileSheet(true)} theme={theme} />

      {/* Profile Sheet */}
      {showProfileSheet && (
        <ProfileSheet 
          onClose={() => setShowProfileSheet(false)} 
          onNavigateToAccount={() => onNavigate('account')}
          onNavigateToSettings={() => onNavigate('settings')}
          onNavigateToWallet={() => onNavigate('wallet')}
          theme={theme}
        />
      )}

      {/* Invite Sheet */}
      <AnimatePresence>
        {showInviteSheet && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40" onClick={() => setShowInviteSheet(false)} 
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className={`fixed bottom-0 left-0 right-0 z-50 ${isDark ? 'bg-slate-800' : 'bg-white'} rounded-t-3xl p-6 max-w-[430px] mx-auto`}
            >
              <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-6" />
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center shadow-lg">
                  <Link2 size={24} className="text-white" />
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Invite Members</h3>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Share this link to join {baseGroup.name}</p>
                </div>
              </div>

              {inviteLink ? (
                <>
                  <div className={`${isDark ? 'bg-slate-700' : 'bg-slate-100'} rounded-xl p-4 mb-4`}>
                    <p className={`text-sm font-mono break-all ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {inviteLink}
                    </p>
                  </div>
                  <button
                    onClick={handleCopyInviteLink}
                    className="w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white py-4 rounded-2xl font-bold shadow-xl active:scale-[0.98] transition-transform flex items-center justify-center gap-2 mb-3"
                  >
                    {linkCopied ? <Check size={20} /> : <Copy size={20} />}
                    {linkCopied ? 'Copied!' : 'Copy Link'}
                  </button>
                  <button
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({ title: `Join ${baseGroup.name} on Tabby`, url: inviteLink });
                      } else {
                        handleCopyInviteLink();
                      }
                    }}
                    className={`w-full ${isDark ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'} py-4 rounded-2xl font-semibold active:scale-[0.98] transition-transform`}
                  >
                    Share Link
                  </button>
                </>
              ) : (
                <p className={`text-center py-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Loading invite link...
                </p>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Group Modal */}
      {showDeleteModal && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setShowDeleteModal(false)} />
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90%] max-w-sm">
            <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-2xl p-6 shadow-2xl`}>
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <h3 className={`text-xl font-bold text-center mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>Delete {baseGroup.name}?</h3>
              <p className={`text-center ${isDark ? 'text-slate-400' : 'text-slate-600'} mb-6`}>This action cannot be undone.</p>
              <div className="space-y-2">
                <button onClick={handleDeleteGroup} className="w-full bg-red-500 text-white py-3 rounded-xl font-semibold active:scale-[0.98] transition-transform">Yes, Delete Group</button>
                <button onClick={() => setShowDeleteModal(false)} className={`w-full ${isDark ? 'bg-slate-700 text-white' : 'bg-gray-200 text-slate-800'} py-3 rounded-xl font-semibold active:scale-[0.98] transition-transform`}>Cancel</button>
              </div>
            </div>
          </motion.div>
        </>
      )}

      {/* Leave Group Modal */}
      {showLeaveModal && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setShowLeaveModal(false)} />
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90%] max-w-sm">
            <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-2xl p-6 shadow-2xl`}>
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
                <LogOut size={24} className="text-orange-500" />
              </div>
              <h3 className={`text-xl font-bold text-center mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>Leave {baseGroup.name}?</h3>
              <p className={`text-center ${isDark ? 'text-slate-400' : 'text-slate-600'} mb-6`}>You'll lose access to this group.</p>
              <div className="space-y-2">
                <button onClick={handleLeaveGroup} className="w-full bg-orange-500 text-white py-3 rounded-xl font-semibold active:scale-[0.98] transition-transform">Yes, Leave Group</button>
                <button onClick={() => setShowLeaveModal(false)} className={`w-full ${isDark ? 'bg-slate-700 text-white' : 'bg-gray-200 text-slate-800'} py-3 rounded-xl font-semibold active:scale-[0.98] transition-transform`}>Cancel</button>
              </div>
            </div>
          </motion.div>
        </>
      )}

      {/* Remove Member Modal */}
      {showRemoveMemberModal && selectedMember && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setShowRemoveMemberModal(false)} />
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90%] max-w-sm">
            <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-2xl p-6 shadow-2xl`}>
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <UserMinus size={24} className="text-red-500" />
              </div>
              <h3 className={`text-xl font-bold text-center mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>Remove {selectedMember.name}?</h3>
              <p className={`text-center ${isDark ? 'text-slate-400' : 'text-slate-600'} mb-6`}>They'll be removed from the group.</p>
              <div className="space-y-2">
                <button onClick={confirmRemoveMember} className="w-full bg-red-500 text-white py-3 rounded-xl font-semibold active:scale-[0.98] transition-transform">Yes, Remove Member</button>
                <button onClick={() => setShowRemoveMemberModal(false)} className={`w-full ${isDark ? 'bg-slate-700 text-white' : 'bg-gray-200 text-slate-800'} py-3 rounded-xl font-semibold active:scale-[0.98] transition-transform`}>Cancel</button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
