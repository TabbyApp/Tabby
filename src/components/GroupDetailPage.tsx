import { useCallback, useEffect, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, Users, CreditCard, Upload, Receipt, DollarSign, Clock, UserPlus, Copy, Check, X, Trash2, LogOut, MoreHorizontal, UserMinus } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { PageType, PageState } from '../App';

type SplitMode = 'EVEN_SPLIT' | 'FULL_CONTROL';

interface GroupDetailPageProps {
  onNavigate: (page: PageType, groupId?: string | number) => void;
  theme: 'light' | 'dark';
  groupId: string | null;
  groups: Array<{ id: string; name: string; members: number; balance: number; color: string; createdBy: string }>;
  deleteGroup: (groupId: string) => void;
  leaveGroup: (groupId: string) => void;
  currentUserId: string;
}

type GroupReceipt = {
  id: string;
  status: string;
  total: number | null;
  created_at: string;
  splits: { user_id: string; amount: number; status: string; name: string }[];
};

const MAX_VISIBLE_AVATARS = 3;

export function GroupDetailPage({ groupId, onNavigate, theme }: GroupDetailPageProps) {
  const isDark = theme === 'dark';
  const { user } = useAuth();
  const [group, setGroup] = useState<{ id: string; name: string; created_by: string; members: { id: string; name: string; email: string }[]; cardLastFour: string | null; inviteToken: string | null } | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [receipts, setReceipts] = useState<GroupReceipt[]>([]);
  const [activeTx, setActiveTx] = useState<{ id: string; status: string; split_mode: string; subtotal?: number | null; tip_amount?: number; allocation_deadline_at: string | null; receipt_id?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [splitMode, setSplitMode] = useState<SplitMode>('EVEN_SPLIT');
  const [tipAmount, setTipAmount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [creatingTx, setCreatingTx] = useState(false);
  const [fullTxDetails, setFullTxDetails] = useState<{
    items: { id: string; name: string; price: number }[];
    claims: Record<string, string[]>;
    members: { id: string; name: string; email: string }[];
    tip_amount: number;
    subtotal: number;
  } | null>(null);
  const [fullTipAmount, setFullTipAmount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'delete' | 'leave' | 'remove' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.groups.get(groupId),
      api.receipts.list(groupId),
      api.transactions.list(groupId).catch(() => []),
    ])
      .then(([groupData, receiptData, txs]) => {
        setGroup(groupData);
        setReceipts(receiptData);
        const pending = Array.isArray(txs) ? txs.find((t) => t.status === 'PENDING_ALLOCATION') : null;
        setActiveTx(pending ?? null);
        // Trigger refetch of FULL_CONTROL details (claims may have changed)
        setFullTxRefreshKey((k) => k + 1);
      })
      .catch((err) => {
        setGroup(null);
        setReceipts([]);
        setActiveTx(null);
        setError(err instanceof Error ? err.message : 'Failed to load group');
      })
      .finally(() => setLoading(false));
  }, [groupId]);

  useEffect(() => { load(); }, [load]);

  const evenTx = activeTx?.split_mode === 'EVEN_SPLIT' ? activeTx : null;
  const fullTx = activeTx?.split_mode === 'FULL_CONTROL' ? activeTx : null;

  useEffect(() => {
    if (evenTx?.tip_amount != null) setTipAmount(evenTx.tip_amount);
  }, [evenTx?.id, evenTx?.tip_amount]);

  // Fetch full transaction details (items, claims) for FULL_CONTROL breakdown
  const [fullTxRefreshKey, setFullTxRefreshKey] = useState(0);
  useEffect(() => {
    if (fullTx?.id && fullTx.receipt_id) {
      api.transactions.get(fullTx.id).then((data) => {
        setFullTxDetails({
          items: data.items,
          claims: data.claims || {},
          members: data.members,
          tip_amount: data.tip_amount ?? 0,
          subtotal: data.subtotal ?? 0,
        });
        setFullTipAmount(data.tip_amount ?? 0);
      }).catch(() => {});
    } else {
      setFullTxDetails(null);
    }
  }, [fullTx?.id, fullTx?.receipt_id, fullTxRefreshKey]);

  if (error) {
    return (
      <div className={`h-[calc(100vh-48px-24px)] flex flex-col items-center justify-center px-6 ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
        <p className={`text-center mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{error}</p>
        <div className="flex gap-3">
          <button onClick={() => onNavigate('groups')} className={`px-4 py-2 rounded-xl font-medium ${isDark ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-800'}`}>Go back</button>
          <button onClick={load} className="px-4 py-2 rounded-xl font-medium bg-blue-500 text-white">Retry</button>
        </div>
      </div>
    );
  }

  // Find current group from groups array
  const currentGroup = groups.find(g => g.id === groupId);
  const isCreator = currentGroup?.createdBy === currentUserId;

  // Mock data - would come from props/state in real app
  const groupDataBase = {
    1: {
      id: 1,
      name: 'Lunch Squad', 
      members: [
        { id: 1, name: 'You', balance: 15.50, avatar: '👤', isYou: true },
        { id: 2, name: 'Sarah Mitchell', balance: -12.20, avatar: '👩', isYou: false },
        { id: 3, name: 'Mike Johnson', balance: 18.10, avatar: '👨', isYou: false },
        { id: 4, name: 'Emma Davis', balance: -21.40, avatar: '👧', isYou: false },
      ],
      balance: 45.80,
      yourBalance: 15.50,
      transactions: [
        { id: 1, description: 'Pizza Palace', amount: 45.80, date: '2h ago', type: 'expense', receipts: 3 },
        { id: 2, description: 'Coffee Shop', amount: 18.20, date: '1d ago', type: 'expense', receipts: 2 },
        { id: 3, description: 'Sarah paid you', amount: 12.20, date: '2d ago', type: 'payment', receipts: 0 },
      ]
    },
    2: { 
      id: 2, 
      name: 'Roommates',
      members: [
        { id: 1, name: 'You', balance: 50.00, avatar: '👤', isYou: true },
        { id: 2, name: 'Alex', balance: -25.00, avatar: '👨', isYou: false },
        { id: 3, name: 'Jordan', balance: -25.00, avatar: '👩', isYou: false },
      ],
      balance: 120.00,
      yourBalance: 50.00,
      transactions: [
        { id: 1, description: 'Groceries', amount: 120.00, date: '1d ago', type: 'expense', receipts: 5 },
      ]
    },
    3: { 
      id: 3, 
      name: 'Road Trip 2026',
      members: [
        { id: 1, name: 'You', balance: 0, avatar: '👤', isYou: true },
        { id: 2, name: 'James', balance: 0, avatar: '👨', isYou: false },
        { id: 3, name: 'Lisa', balance: 0, avatar: '👩', isYou: false },
        { id: 4, name: 'David', balance: 0, avatar: '👨', isYou: false },
        { id: 5, name: 'Emily', balance: 0, avatar: '👧', isYou: false },
        { id: 6, name: 'Chris', balance: 0, avatar: '👦', isYou: false },
      ],
      balance: 0,
      yourBalance: 0,
      transactions: []
    },
    4: { 
      id: 4, 
      name: 'Office Lunch',
      members: [
        { id: 1, name: 'You', balance: 25.00, avatar: '👤', isYou: true },
        { id: 2, name: 'Tom', balance: -12.50, avatar: '👨', isYou: false },
        { id: 3, name: 'Rachel', balance: 30.00, avatar: '👩', isYou: false },
        { id: 4, name: 'Steve', balance: -18.00, avatar: '👨', isYou: false },
        { id: 5, name: 'Megan', balance: -24.50, avatar: '👧', isYou: false },
      ],
      balance: 67.50,
      yourBalance: 25.00,
      transactions: [
        { id: 1, description: 'Sushi Restaurant', amount: 67.50, date: '3h ago', type: 'expense', receipts: 2 },
        { id: 2, description: 'Coffee & Bagels', amount: 28.00, date: '2d ago', type: 'expense', receipts: 1 },
      ]
    },
  };

  // Track removed members
  const [removedMembers, setRemovedMembers] = useState<number[]>([]);

  // Use mock data when available; for API string ids use fallback (first mock group)
  const baseGroup = (groupId && (groupDataBase as Record<string, typeof groupDataBase[1]>)[String(groupId)]) ?? groupDataBase[1];
  
  // Filter out removed members
  const group = {
    ...baseGroup,
    members: baseGroup.members.filter(m => !removedMembers.includes(m.id))
  };

  const handleRemoveMember = (member: any) => {
    setSelectedMember(member);
    setShowRemoveMemberModal(true);
    setShowMenu(false);
  };

  const confirmRemoveMember = () => {
    if (selectedMember) {
      setRemovedMembers([...removedMembers, selectedMember.id]);
      setShowRemoveMemberModal(false);
      setSelectedMember(null);
    }
  };

  const handleDeleteGroup = () => {
    // Mock implementation - in real app would delete from database
    console.log('Deleting group:', groupId);
    if (groupId) {
      deleteGroup(groupId);
    }
    setShowDeleteModal(false);
    // Navigate back to groups page
    setTimeout(() => {
      onNavigate('groups');
    }, 100);
  };

  const handleLeaveGroup = () => {
    // Mock implementation - in real app would remove user from group
    console.log('Leaving group:', groupId);
    if (groupId) {
      leaveGroup(groupId);
    }
    setShowLeaveModal(false);
    // Navigate back to groups page
    setTimeout(() => {
      onNavigate('groups');
    }, 100);
  };

  const isCreator = group.created_by === user?.id;
  const extractedTotal = evenTx?.subtotal ?? 0;
  const hasTotal = extractedTotal > 0;

  const visibleMembers = group.members.slice(0, MAX_VISIBLE_AVATARS);
  const overflowCount = group.members.length - MAX_VISIBLE_AVATARS;

  const handleEvenConfirm = async () => {
    if (!isCreator || !evenTx) return;
    setSubmitting(true);
    try {
      await api.transactions.setTip(evenTx.id, tipAmount);
      const { allocations } = await api.transactions.finalize(evenTx.id);
      onNavigate({ page: 'processing', groupId, transactionId: evenTx.id, splits: allocations });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to complete payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFullControlConfirm = async () => {
    if (!isCreator || !fullTx) return;
    setSubmitting(true);
    try {
      await api.transactions.setTip(fullTx.id, fullTipAmount);
      const { allocations } = await api.transactions.finalize(fullTx.id);
      onNavigate({ page: 'processing', groupId, transactionId: fullTx.id, splits: allocations });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to complete payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadReceipt = async (file: File | null) => {
    if (!file || !isCreator) return;
    setCreatingTx(true);
    setError(null);
    try {
      const tx = (splitMode === 'EVEN_SPLIT' ? evenTx : fullTx) ?? (await api.transactions.create(groupId, splitMode));
      const result = await api.transactions.uploadReceipt(tx.id, file);
      if (result?.receipt_id) {
        await load();
        if (splitMode === 'FULL_CONTROL') {
          onNavigate({ page: 'receiptItems', groupId, transactionId: tx.id, receiptId: result.receipt_id });
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to upload');
    } finally {
      setCreatingTx(false);
    }
  };

  const handleDeleteGroup = async () => {
    setActionLoading(true);
    try {
      await api.groups.deleteGroup(groupId);
      onNavigate('groups');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete group');
      setConfirmAction(null);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    setActionLoading(true);
    try {
      await api.groups.leaveGroup(groupId);
      onNavigate('groups');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to leave group');
      setConfirmAction(null);
    } finally {
      setActionLoading(false);
    }
  };

  const confirmRemoveMember = (member: { id: string; name: string }) => {
    setMemberToRemove(member);
    setConfirmAction('remove');
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    setActionLoading(true);
    try {
      await api.groups.removeMember(groupId, memberToRemove.id);
      setConfirmAction(null);
      setMemberToRemove(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove member');
      setConfirmAction(null);
      setMemberToRemove(null);
    } finally {
      setActionLoading(false);
    }
  };

  const inviteLink = group.inviteToken ? `${window.location.origin}/?invite=${group.inviteToken}` : '';

  return (
    <div className={`h-[calc(100vh-48px-24px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
      {/* Header */}
      <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-b px-5 py-4`}>
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => onNavigate('groups')} className={`w-9 h-9 rounded-full flex-shrink-0 ${isDark ? 'bg-slate-700' : 'bg-gray-100'} flex items-center justify-center active:scale-95 transition-transform`}>
              <ChevronLeft size={20} className={isDark ? 'text-white' : 'text-slate-800'} strokeWidth={2.5} />
            </button>
            <h1 className={`text-2xl font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{group.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex-shrink-0 rounded-full p-0.5 ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
              <button onClick={() => setSplitMode('EVEN_SPLIT')} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${splitMode === 'EVEN_SPLIT' ? 'bg-white shadow-sm text-slate-800' : isDark ? 'text-slate-400' : 'text-slate-600'}`}>Even</button>
              <button onClick={() => setSplitMode('FULL_CONTROL')} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${splitMode === 'FULL_CONTROL' ? 'bg-white shadow-sm text-slate-800' : isDark ? 'text-slate-400' : 'text-slate-600'}`}>Item split</button>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform ${isDark ? 'bg-slate-700' : 'bg-gray-100'}`}
              >
                <MoreHorizontal size={18} className={isDark ? 'text-white' : 'text-slate-600'} />
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.95 }}
                      transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                      className={`absolute top-11 right-0 z-30 rounded-xl shadow-xl border min-w-[180px] overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
                    >
                      {isCreator ? (
                        <button
                          type="button"
                          onClick={() => { setMenuOpen(false); setConfirmAction('delete'); }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-500 ${isDark ? 'hover:bg-slate-700' : 'hover:bg-red-50'} transition-colors`}
                        >
                          <Trash2 size={16} />
                          Delete Group
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setMenuOpen(false); setConfirmAction('leave'); }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-500 ${isDark ? 'hover:bg-slate-700' : 'hover:bg-red-50'} transition-colors`}
                        >
                          <LogOut size={16} />
                          Leave Group
                        </button>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{group.members.length} member{group.members.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4" style={{ WebkitOverflowScrolling: 'touch' }}>
        {/* Member avatars row + Invite */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setMembersOpen(!membersOpen)}
              className="flex items-center active:scale-95 transition-transform"
            >
              <div className="flex -space-x-2">
                {visibleMembers.map((m) => (
                  <div
                    key={m.id}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold border-2 border-green-400 shadow-sm transition-all ${
                      isDark ? 'bg-slate-700 text-white' : 'bg-white text-slate-700'
                    }`}
                  >
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                ))}
                {overflowCount > 0 && (
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2 shadow-sm ${
                      isDark ? 'bg-slate-600 border-slate-500 text-slate-200' : 'bg-slate-100 border-slate-200 text-slate-600'
                    }`}
                  >
                    +{overflowCount}
                  </div>
                )}
              </div>
            </button>

            {/* Members dropdown */}
            <AnimatePresence>
              {membersOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setMembersOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                    className={`absolute top-12 left-0 z-30 rounded-2xl shadow-xl border p-2 min-w-[220px] ${
                      isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
                    }`}
                  >
                    <p className={`text-[11px] font-semibold uppercase tracking-wider px-3 pt-2 pb-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                    </p>
                    {group.members.map((m, i) => (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className={`flex items-center gap-2.5 py-2 px-3 rounded-xl ${isDark ? 'hover:bg-slate-700/60' : 'hover:bg-slate-50'} transition-colors`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-[1.5px] border-green-400 ${isDark ? 'bg-slate-700 text-white' : 'bg-white text-slate-700'}`}>
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{m.name}</p>
                        </div>
                        {m.id === group.created_by ? (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-50 text-purple-500'}`}>Host</span>
                        ) : isCreator ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setMembersOpen(false); confirmRemoveMember(m); }}
                            className={`p-1 rounded-full transition-colors ${isDark ? 'hover:bg-red-500/20' : 'hover:bg-red-50'}`}
                            title="Remove"
                          >
                            <X size={14} className="text-red-400" />
                          </button>
                        ) : null}
                      </motion.div>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all active:scale-95 bg-blue-500 text-white hover:bg-blue-600"
          >
            <UserPlus size={16} />
            Invite
          </button>
        </div>

        {/* Invite bottom sheet */}
        <AnimatePresence>
          {inviteOpen && (
            <div className="fixed inset-0 z-40 flex items-end justify-center" onClick={() => setInviteOpen(false)}>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 bg-black/40"
              />
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 350 }}
                className={`relative z-50 w-full max-w-[430px] rounded-t-[24px] px-6 pt-3 pb-10 ${isDark ? 'bg-slate-800' : 'bg-white'}`}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Drag handle */}
                <div className="flex justify-center mb-4">
                  <div className={`w-9 h-[5px] rounded-full ${isDark ? 'bg-slate-600' : 'bg-slate-200'}`} />
                </div>

                <div className="flex items-center justify-between mb-5">
                  <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Invite to {group.name}</h3>
                  <button
                    type="button"
                    onClick={() => setInviteOpen(false)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200'}`}
                  >
                    <X size={16} className={isDark ? 'text-slate-300' : 'text-slate-500'} />
                  </button>
                </div>

                <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Share link</p>
                <div className="mb-5">
                  <input
                    readOnly
                    value={inviteLink}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-mono mb-3 ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-50 text-slate-600'}`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(inviteLink);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
                      copied ? 'bg-green-500 text-white' : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                    {copied ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>

                {group.inviteToken && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="flex flex-col items-center"
                  >
                    <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Or scan QR code</p>
                    <div className="p-5 rounded-2xl bg-white shadow-sm">
                      <QRCodeSVG value={inviteLink} size={180} />
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Virtual Card */}
        <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 shadow-sm`}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
              <CreditCard size={20} className="text-white" />
            </div>
            <div>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Virtual Card</p>
              <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>•••• •••• •••• {group.cardLastFour || '----'}</p>
            </div>
          </div>
          <button onClick={() => onNavigate('wallet')} className="text-blue-500 text-sm font-medium">View in Wallet</button>
        </div>
      </motion.div>

        {/* Members list */}
        <div>
          <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide mb-2`}>Members</h2>
          <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl overflow-hidden shadow-sm`}>
            {group.members.map((m, i) => (
              <div key={m.id} className={`flex items-center gap-3 p-4 ${i > 0 ? `border-t ${isDark ? 'border-slate-700' : 'border-gray-100'}` : ''}`}>
                <div className={`w-10 h-10 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-100'} flex items-center justify-center`}>
                  <Users size={18} className={isDark ? 'text-slate-400' : 'text-slate-600'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`font-medium truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{m.name}</p>
                    {m.id === group.created_by && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-50 text-purple-500'}`}>Host</span>
                    )}
                  </div>
                  <p className={`text-sm truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{m.email}</p>
                </div>
                {isCreator && m.id !== user?.id && (
                  <button
                    type="button"
                    onClick={() => confirmRemoveMember(m)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors active:scale-95 ${
                      isDark ? 'hover:bg-red-500/20' : 'hover:bg-red-50'
                    }`}
                    title="Remove member"
                  >
                    <UserMinus size={15} className="text-red-400" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Split modes */}
        <AnimatePresence mode="wait">
          {splitMode === 'EVEN_SPLIT' ? (
            <motion.div key="even" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg" className="hidden" onChange={(e) => { handleUploadReceipt(e.target.files?.[0] || null); e.target.value = ''; }} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!isCreator || creatingTx}
                className={`w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-60 ${
                  hasTotal ? 'border-2 border-dashed border-purple-500 bg-purple-500/10 text-purple-600' : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                }`}
              >
                <Upload size={22} strokeWidth={2.5} />
                {creatingTx ? 'Uploading...' : hasTotal ? 'Replace receipt' : 'Upload Receipt'}
              </button>
              {!hasTotal && (
                <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Upload a receipt to start splitting</p>
              )}
              {hasTotal && (
                <>
                  <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 shadow-sm`}>
                    <p className={`text-sm font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total</p>
                    <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>${extractedTotal.toFixed(2)}</p>
                    <p className={`text-sm font-medium mb-3 mt-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Tip</p>
                    <div className="flex items-center gap-4">
                      <input type="range" min="0" max={Math.max(50, Math.ceil(extractedTotal * 0.3))} step="0.5" value={tipAmount} onChange={(e) => setTipAmount(parseFloat(e.target.value) || 0)} disabled={!isCreator} className="flex-1" />
                      <span className={`font-bold w-16 text-right ${isDark ? 'text-white' : 'text-slate-800'}`}>${tipAmount.toFixed(2)}</span>
                    </div>
                    <div className={`mt-4 pt-4 border-t ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                      <div className="flex justify-between">
                        <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Split among {group.members.length}</span>
                        <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>${((extractedTotal + tipAmount) / group.members.length).toFixed(2)} each</span>
                      </div>
                    </div>
                  </div>
                  {evenTx?.allocation_deadline_at && (
                    <div className="flex items-center gap-2 text-sm text-amber-600">
                      <Clock size={16} />
                      <span>Deadline: {new Date(evenTx.allocation_deadline_at).toLocaleTimeString()}</span>
                    </div>
                  )}
                  {isCreator && (
                    <button onClick={handleEvenConfirm} disabled={submitting} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-xl font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                      <DollarSign size={22} strokeWidth={2.5} />
                      {submitting ? 'Processing...' : 'Confirm & Pay'}
                    </button>
                  )}
                </>
              )}
            </motion.div>
          ) : (
            <motion.div key="full" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg" className="hidden" onChange={(e) => { handleUploadReceipt(e.target.files?.[0] || null); e.target.value = ''; }} />
              {fullTx?.receipt_id ? (
                <>
                  {/* Assign / Edit selections button */}
                  <button onClick={() => onNavigate({ page: 'receiptItems', groupId, transactionId: fullTx.id, receiptId: fullTx.receipt_id! })} className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 ${
                    fullTxDetails && fullTxDetails.items.length > 0 && fullTxDetails.items.every((item) => (fullTxDetails.claims[item.id] || []).length > 0)
                      ? `border-2 border-purple-500 bg-purple-500/10 text-purple-600`
                      : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                  }`}>
                    <Receipt size={20} strokeWidth={2.5} />
                    {fullTxDetails && fullTxDetails.items.length > 0 && fullTxDetails.items.every((item) => (fullTxDetails.claims[item.id] || []).length > 0)
                      ? 'Edit Selections'
                      : 'Assign Items'}
                  </button>

                  {/* Itemized breakdown */}
                  {fullTxDetails && fullTxDetails.items.length > 0 && (() => {
                    const memberTotals = fullTxDetails.members.map((m) => {
                      const items = fullTxDetails.items.filter((item) => (fullTxDetails.claims[item.id] || []).includes(m.id));
                      const total = items.reduce((sum, item) => {
                        const claimers = fullTxDetails.claims[item.id] || [];
                        return sum + item.price / claimers.length;
                      }, 0);
                      return { ...m, items, total };
                    });
                    const itemSubtotal = fullTxDetails.items.reduce((s, i) => s + i.price, 0);
                    const allClaimed = fullTxDetails.items.every((item) => (fullTxDetails.claims[item.id] || []).length > 0);
                    const grandTotal = itemSubtotal + fullTipAmount;

                    return (
                      <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl overflow-hidden shadow-sm`}>
                        <div className="px-4 pt-4 pb-2">
                          <h3 className={`text-sm font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Item Breakdown</h3>
                        </div>
                        {memberTotals.map((m, i) => (
                          <div key={m.id} className={`px-4 py-3 ${i > 0 ? `border-t ${isDark ? 'border-slate-700' : 'border-gray-100'}` : ''}`}>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${isDark ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'}`}>
                                  {m.name.charAt(0).toUpperCase()}
                                </div>
                                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                  {m.id === user?.id ? 'You' : m.name}
                                </p>
                              </div>
                              <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                ${m.total.toFixed(2)}
                              </p>
                            </div>
                            {m.items.length > 0 ? (
                              <div className="ml-9 space-y-0.5">
                                {m.items.map((item) => {
                                  const claimers = fullTxDetails.claims[item.id] || [];
                                  const share = item.price / claimers.length;
                                  return (
                                    <div key={item.id} className="flex items-center justify-between">
                                      <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                        {item.name}{claimers.length > 1 ? ` (1/${claimers.length})` : ''}
                                      </span>
                                      <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                        ${share.toFixed(2)}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="ml-9 text-xs text-slate-400 italic">No items selected</p>
                            )}
                          </div>
                        ))}

                        {/* Totals */}
                        <div className={`px-4 py-3 border-t ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Subtotal</span>
                            <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>${itemSubtotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Tip</span>
                            <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>${fullTipAmount.toFixed(2)}</span>
                          </div>
                          <div className={`flex justify-between text-sm pt-2 border-t ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
                            <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Total</span>
                            <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>${grandTotal.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Tip slider - host only */}
                        {isCreator && (
                          <div className={`px-4 py-3 border-t ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                            <p className={`text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Tip</p>
                            <div className="flex items-center gap-4">
                              <input
                                type="range"
                                min="0"
                                max={Math.max(50, Math.ceil(itemSubtotal * 0.3))}
                                step="0.5"
                                value={fullTipAmount}
                                onChange={(e) => setFullTipAmount(parseFloat(e.target.value) || 0)}
                                className="flex-1"
                              />
                              <span className={`font-bold w-16 text-right ${isDark ? 'text-white' : 'text-slate-800'}`}>${fullTipAmount.toFixed(2)}</span>
                            </div>
                          </div>
                        )}

                        {!allClaimed && (
                          <div className="px-4 pb-3">
                            <p className="text-xs text-orange-500">All items must be assigned before confirming payment</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Confirm & Pay button - host only */}
                  {isCreator && fullTxDetails && fullTxDetails.items.length > 0 && fullTxDetails.items.every((item) => (fullTxDetails.claims[item.id] || []).length > 0) && (
                    <button
                      onClick={handleFullControlConfirm}
                      disabled={submitting}
                      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-xl font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      <DollarSign size={22} strokeWidth={2.5} />
                      {submitting ? 'Processing...' : 'Confirm & Pay'}
                    </button>
                  )}

                  {isCreator && (
                    <button onClick={() => fileInputRef.current?.click()} disabled={creatingTx} className="w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-60 border-2 border-dashed border-purple-500 bg-purple-500/10 text-purple-600">
                      <Upload size={20} strokeWidth={2.5} />
                      {creatingTx ? 'Uploading...' : 'Replace receipt'}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button onClick={() => fileInputRef.current?.click()} disabled={!isCreator || creatingTx} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
                    <Upload size={22} strokeWidth={2.5} />
                    {creatingTx ? 'Uploading...' : 'Upload Receipt'}
                  </button>
                  {!fullTx && (
                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Upload a receipt to start splitting items</p>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recent transactions */}
        <div className="mt-6">
          <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide mb-2`}>Recent transactions</h2>
          {receipts.length === 0 ? (
            <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-6 text-center`}>
              <Receipt size={28} className={`${isDark ? 'text-slate-500' : 'text-slate-300'} mx-auto mb-2`} />
              <p className={`${isDark ? 'text-slate-400' : 'text-slate-500'} text-sm`}>No receipts yet. Upload one to start splitting.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {receipts.map((r) => (
                <div key={r.id} className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 shadow-sm border ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {transaction.description}
                      </p>
                      <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {transaction.date}
                      </p>
                    </div>
                    <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>${r.total ? r.total.toFixed(2) : '—'}</p>
                  </div>
                  {r.splits.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {r.splits.map((split) => (
                        <div key={split.user_id} className="flex items-center justify-between text-sm">
                          <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>{split.name}</span>
                          <span className="font-medium">${split.amount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => onNavigate({ page: 'receiptItems', receiptId: r.id, groupId })} className="mt-3 text-sm text-blue-500 font-medium">View / Edit split</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirm delete/leave/remove dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => !actionLoading && setConfirmAction(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
            className={`relative z-50 w-[calc(100%-2rem)] max-w-[340px] rounded-2xl p-6 shadow-xl ${isDark ? 'bg-slate-800' : 'bg-white'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${
                confirmAction === 'delete' ? 'bg-red-100' : confirmAction === 'remove' ? 'bg-red-100' : 'bg-amber-100'
              }`}>
                {confirmAction === 'delete' ? (
                  <Trash2 size={24} className="text-red-500" />
                ) : confirmAction === 'remove' ? (
                  <UserMinus size={24} className="text-red-500" />
                ) : (
                  <LogOut size={24} className="text-amber-500" />
                )}
              </div>
              <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {confirmAction === 'delete' ? 'Delete Group?' : confirmAction === 'remove' ? `Remove ${memberToRemove?.name}?` : 'Leave Group?'}
              </h3>
              <p className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {confirmAction === 'delete'
                  ? 'This will permanently delete the group, all receipts, and transaction history. This cannot be undone.'
                  : confirmAction === 'remove'
                  ? `${memberToRemove?.name} will be removed from the group. They can rejoin via the invite link.`
                  : 'You will be removed from this group and lose access to its receipts and history.'
                }
              </p>
              <div className="flex gap-3 w-full">
                <button
                  type="button"
                  onClick={() => { setConfirmAction(null); setMemberToRemove(null); }}
                  disabled={actionLoading}
                  className={`flex-1 py-2.5 rounded-xl font-medium text-sm ${isDark ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'}`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmAction === 'delete' ? handleDeleteGroup : confirmAction === 'remove' ? handleRemoveMember : handleLeaveGroup}
                  disabled={actionLoading}
                  className="flex-1 py-2.5 rounded-xl font-medium text-sm bg-red-500 text-white disabled:opacity-60"
                >
                  {actionLoading ? 'Processing...' : confirmAction === 'delete' ? 'Delete' : confirmAction === 'remove' ? 'Remove' : 'Leave'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}