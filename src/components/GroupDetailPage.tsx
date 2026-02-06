import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Users, CreditCard, Upload, Receipt, UserPlus, Copy, Trash2, LogOut, Loader } from 'lucide-react';
import QRCode from 'qrcode';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { PageType, PageState } from '../App';

interface GroupDetailPageProps {
  groupId: string;
  onNavigate: (target: PageType | PageState) => void;
  theme: 'light' | 'dark';
}

type GroupReceipt = {
  id: string;
  status: string;
  total: number | null;
  created_at: string;
  splits: { user_id: string; amount: number; status: string; name: string }[];
};

export function GroupDetailPage({ groupId, onNavigate, theme }: GroupDetailPageProps) {
  const isDark = theme === 'dark';
  const { user: currentUser } = useAuth();
  const [group, setGroup] = useState<{ id: string; name: string; created_by: string; members: { id: string; name: string; email: string; phone: string | null; status: 'joined' }[]; pendingInvites: { id: string; phone: string; token: string; createdAt: string; status: 'invited' }[]; cardLastFour: string | null } | null>(null);
  const [resendingInvite, setResendingInvite] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<GroupReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteQr, setInviteQr] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [copyDone, setCopyDone] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([api.groups.get(groupId), api.receipts.list(groupId)])
      .then(([groupData, receiptData]) => {
        setGroup(groupData);
        setReceipts(receiptData);
      })
      .catch((err) => {
        setGroup(null);
        setReceipts([]);
        setError(err instanceof Error ? err.message : 'Failed to load group');
      })
      .finally(() => setLoading(false));
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  const isCreator = group && currentUser && group.created_by === currentUser.id;

  const handleOpenInvite = useCallback(() => {
    setInviteOpen(true);
    setInviteLink(null);
    setInviteQr(null);
    setInviteError('');
    setInviteLoading(true);
    api.groups
      .createInvite(groupId)
      .then(({ inviteLink: link }) => {
        setInviteLink(link);
        QRCode.toDataURL(link, { width: 200, margin: 2 }).then(setInviteQr).catch(() => setInviteQr(null));
      })
      .catch((err) => {
        setInviteError(err instanceof Error ? err.message : 'Failed to create invite link');
      })
      .finally(() => setInviteLoading(false));
  }, [groupId]);

  const handleCopyLink = useCallback(() => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    });
  }, [inviteLink]);

  const handleDeleteGroup = useCallback(() => {
    if (!groupId) return;
    setActionLoading(true);
    api.groups
      .delete(groupId)
      .then(() => onNavigate('groups'))
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to delete group');
      })
      .finally(() => {
        setActionLoading(false);
        setDeleteConfirm(false);
      });
  }, [groupId, onNavigate]);

  const handleResendPhoneInvite = useCallback(async (inviteId: string) => {
    if (!group) return;
    setResendingInvite(inviteId);
    try {
      await api.groups.resendPhoneInvite(group.id, inviteId);
      load();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to resend invite');
    } finally {
      setResendingInvite(null);
    }
  }, [group, load]);

  const handleRemovePhoneInvite = useCallback(async (inviteId: string) => {
    if (!group) return;
    setActionLoading(true);
    try {
      await api.groups.removePhoneInvite(group.id, inviteId);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove invite');
    } finally {
      setActionLoading(false);
    }
  }, [group, load]);

  const normalizePhoneDisplay = (phone: string) => {
    const d = phone.replace(/\D/g, '');
    if (d.length === 11 && d.startsWith('1')) {
      const rest = d.slice(1);
      return `(${rest.slice(0, 3)}) ${rest.slice(3, 6)}-${rest.slice(6)}`;
    }
    if (d.length === 10) {
      return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    }
    return phone;
  };

  const handleLeaveGroup = useCallback(() => {
    if (!groupId) return;
    setActionLoading(true);
    api.groups
      .leave(groupId)
      .then(() => onNavigate('groups'))
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to leave');
      })
      .finally(() => {
        setActionLoading(false);
        setLeaveConfirm(false);
      });
  }, [groupId, onNavigate]);

  const handleRemoveMember = useCallback(
    (userId: string) => {
      if (!groupId) return;
      setActionLoading(true);
      api.groups
        .removeMember(groupId, userId)
        .then(load)
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Failed to remove member');
        })
        .finally(() => {
          setActionLoading(false);
          setRemoveConfirm(null);
        });
    },
    [groupId, load]
  );

  if (error) {
    return (
      <div className={`h-[calc(100vh-48px-24px)] flex flex-col items-center justify-center px-6 ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
        <p className={`text-center mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{error}</p>
        <div className="flex gap-3">
          <button
            onClick={() => onNavigate('groups')}
            className={`px-4 py-2 rounded-xl font-medium ${isDark ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-800'}`}
          >
            Go back
          </button>
          <button
            onClick={load}
            className="px-4 py-2 rounded-xl font-medium bg-blue-500 text-white"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const showContent = !loading && group;

  return (
    <div className={`h-[calc(100vh-48px-24px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-b px-5 py-4`}
      >
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => onNavigate('groups')}
            className={`w-9 h-9 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-100'} flex items-center justify-center active:scale-95 transition-transform`}
          >
            <ChevronLeft size={20} className={isDark ? 'text-white' : 'text-slate-800'} strokeWidth={2.5} />
          </button>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{group?.name ?? 'Group'}</h1>
        </div>
        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          {group ? `${group.members.length} members` : '…'}
        </p>
      </motion.div>

      {/* Invite modal: Copy link + QR code (no email) */}
      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setInviteOpen(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-2xl shadow-xl max-w-sm w-full p-5`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'} mb-3`}>Invite to group</h3>
            {inviteLoading && !inviteLink ? (
              <div className="py-8 flex flex-col items-center gap-3">
                <Loader size={32} className="animate-spin text-blue-500" />
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Creating invite link...</p>
              </div>
            ) : inviteError && !inviteLink ? (
              <>
                <p className={`text-sm text-red-500 mb-4`}>{inviteError}</p>
                <button onClick={() => setInviteOpen(false)} className={`w-full py-2.5 rounded-xl font-medium ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-200 text-slate-700'}`}>
                  Close
                </button>
              </>
            ) : inviteLink ? (
              <>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'} mb-3`}>Share this link or QR code — anyone with the link can join.</p>
                <div className="flex items-center gap-2 mb-4">
                  <input readOnly value={inviteLink} className={`flex-1 text-xs px-3 py-2.5 rounded-xl ${isDark ? 'bg-slate-700 text-slate-200' : 'bg-gray-100 text-slate-700'}`} />
                  <button onClick={handleCopyLink} className={`flex-shrink-0 px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 ${copyDone ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'}`}>
                    <Copy size={18} />
                    {copyDone ? 'Copied!' : 'Copy link'}
                  </button>
                </div>
                {inviteQr && (
                  <div className="flex justify-center my-4 p-3 bg-white rounded-xl">
                    <img src={inviteQr} alt="QR code" className="w-44 h-44" />
                  </div>
                )}
                <button onClick={() => setInviteOpen(false)} className="w-full py-3 rounded-xl font-medium bg-slate-200 text-slate-700">
                  Done
                </button>
              </>
            ) : null}
          </motion.div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4">
        {showContent ? (
          <>
        <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 shadow-sm`}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
              <CreditCard size={20} className="text-white" />
            </div>
            <div>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Virtual Card</p>
              <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                •••• •••• •••• {group!.cardLastFour || '----'}
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('wallet')}
            className="text-blue-500 text-sm font-medium"
          >
            View in Wallet
          </button>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide`}>
              Members
            </h2>
            {isCreator && (
              <button
                onClick={handleOpenInvite}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-sm ${isDark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
              >
                <UserPlus size={18} strokeWidth={2.5} />
                Invite
              </button>
            )}
          </div>
          <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl overflow-hidden shadow-sm`}>
            {group.members.map((m, i) => (
              <div
                key={m.id}
                className={`flex items-center gap-3 p-4 ${i > 0 ? `border-t ${isDark ? 'border-slate-700' : 'border-gray-100'}` : ''}`}
              >
                <div className={`w-10 h-10 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-100'} flex items-center justify-center`}>
                  <Users size={18} className={isDark ? 'text-slate-400' : 'text-slate-600'} />
                </div>
                <div className="flex-1">
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {m.name}
                    {m.id === group.created_by && (
                      <span className={`ml-2 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>(creator)</span>
                    )}
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded ${isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'}`}>
                      Joined
                    </span>
                  </p>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{m.email}</p>
                </div>
                {isCreator && m.id !== group.created_by && (
                  <div>
                    {removeConfirm === m.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => setRemoveConfirm(null)} className="px-2 py-1 text-xs rounded bg-slate-200 text-slate-700">Cancel</button>
                        <button onClick={() => handleRemoveMember(m.id)} disabled={actionLoading} className="px-2 py-1 text-xs rounded bg-red-500 text-white disabled:opacity-50">
                          Remove
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setRemoveConfirm(m.id)} className="p-2 rounded-lg text-red-500 hover:bg-red-50" title="Remove member">
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {group.pendingInvites.map((invite, i) => (
                <div
                  key={invite.phone}
                  className={`flex items-center gap-3 p-4 ${group.members.length > 0 || i > 0 ? `border-t ${isDark ? 'border-slate-700' : 'border-gray-100'}` : ''}`}
                >
                  <div className={`w-10 h-10 rounded-full ${isDark ? 'bg-amber-900/30' : 'bg-amber-100'} flex items-center justify-center`}>
                    <UserPlus size={18} className={isDark ? 'text-amber-400' : 'text-amber-600'} />
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>
                      {normalizePhoneDisplay(invite.phone)}
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded ${isDark ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-100 text-amber-700'}`}>
                        Invited
                      </span>
                    </p>
                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Invite sent</p>
                  </div>
                  {isCreator && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResendPhoneInvite(invite.id)}
                        disabled={resendingInvite === invite.id}
                        className={`px-3 py-1.5 text-xs rounded font-medium ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'} disabled:opacity-50 flex items-center gap-1`}
                      >
                        {resendingInvite === invite.id ? <Loader size={14} className="animate-spin" /> : null}
                        Resend
                      </button>
                      <button
                        onClick={() => handleRemovePhoneInvite(invite.id)}
                        disabled={actionLoading}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50"
                        title="Remove invite"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide mb-2`}>
            Recent receipts
          </h2>
          {receipts.length === 0 ? (
            <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-6 text-center`}>
              <Receipt size={28} className={`${isDark ? 'text-slate-500' : 'text-slate-300'} mx-auto mb-2`} />
              <p className={`${isDark ? 'text-slate-400' : 'text-slate-500'} text-sm`}>
                No receipts yet. Upload one to start splitting.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {receipts.map((r) => (
                <div
                  key={r.id}
                  className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 shadow-sm border ${isDark ? 'border-slate-700' : 'border-slate-100'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        {new Date(r.created_at).toLocaleDateString()} {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{r.status === 'completed' ? 'Completed' : 'Pending'}</p>
                    </div>
                    <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      ${r.total ? r.total.toFixed(2) : '—'}
                    </p>
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
                  <button
                    onClick={() => onNavigate({ page: 'receiptItems', receiptId: r.id, groupId })}
                    className="mt-3 text-sm text-blue-500 font-medium"
                  >
                    View / Edit split
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => onNavigate({ page: 'receiptScan', groupId })}
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2"
        >
          <Upload size={22} strokeWidth={2.5} />
          Upload Receipt
        </button>

        {/* Delete group / Leave group */}
        <div className="pt-4 space-y-2">
          {isCreator ? (
            <>
              {deleteConfirm ? (
                <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 border border-red-200`}>
                  <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'} mb-3`}>Delete this group? This cannot be undone. All receipts and data will be removed.</p>
                  <div className="flex gap-2">
                    <button onClick={() => setDeleteConfirm(false)} className={`flex-1 py-2.5 rounded-xl font-medium ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-200 text-slate-700'}`}>
                      Cancel
                    </button>
                    <button 
                      onClick={handleDeleteGroup} 
                      disabled={actionLoading} 
                      className={`flex-1 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 ${
                        actionLoading 
                          ? 'bg-red-400 text-white opacity-75 cursor-wait' 
                          : 'bg-red-500 text-white hover:bg-red-600 active:scale-95'
                      } transition-colors`}
                    >
                      {actionLoading && <Loader size={18} className="animate-spin" />}
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setDeleteConfirm(true)} className={`w-full py-3 rounded-xl font-medium text-red-500 ${isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-white hover:bg-gray-50'} border border-red-200`}>
                  Delete group
                </button>
              )}
            </>
          ) : (
            <>
              {leaveConfirm ? (
                <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 border border-amber-200`}>
                  <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'} mb-3`}>Leave this group? You will lose access to its receipts and card.</p>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setLeaveConfirm(false)} 
                      className={`flex-1 py-2.5 rounded-xl font-medium ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-gray-200 text-slate-700 hover:bg-gray-300'} transition-colors`}
                    >
                      <span>Cancel</span>
                    </button>
                    <button 
                      onClick={handleLeaveGroup} 
                      disabled={actionLoading} 
                      className={`flex-1 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 ${
                        actionLoading 
                          ? 'bg-amber-400 text-white cursor-wait opacity-75' 
                          : 'bg-amber-500 text-white hover:bg-amber-600 active:scale-95'
                      } transition-all`}
                    >
                      {actionLoading ? (
                        <>
                          <Loader size={18} className="animate-spin" />
                          <span>Leaving...</span>
                        </>
                      ) : (
                        <span>Leave</span>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setLeaveConfirm(true)} className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-white text-slate-600 hover:bg-gray-50'} border ${isDark ? 'border-slate-600' : 'border-gray-200'}`}>
                  <LogOut size={18} />
                  Leave group
                </button>
              )}
            </>
          )}
        </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center py-12">
            <Loader size={32} className="animate-spin text-blue-500" />
          </div>
        )}
      </div>
    </div>
  );
}
