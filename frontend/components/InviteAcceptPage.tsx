import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, UserPlus, Loader, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { PageType, PageState } from '../App';

interface InviteAcceptPageProps {
  inviteToken: string;
  onNavigate: (target: PageType | PageState) => void;
  theme: 'light' | 'dark';
}

export function InviteAcceptPage({ inviteToken, onNavigate, theme }: InviteAcceptPageProps) {
  const isDark = theme === 'dark';
  const { user } = useAuth();
  const [invite, setInvite] = useState<{
    groupName: string;
    inviterName: string;
    inviteeEmail: string;
    token: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);

  useEffect(() => {
    setError(null);
    setLoading(true);
    api.invites
      .getByToken(inviteToken)
      .then((data) => {
        setInvite({
          groupName: data.groupName,
          inviterName: data.inviterName,
          inviteeEmail: data.inviteeEmail,
          token: data.token,
        });
      })
      .catch((err) => {
        setInvite(null);
        setError(err instanceof Error ? err.message : 'Invite not found');
      })
      .finally(() => setLoading(false));
  }, [inviteToken]);

  const handleAccept = () => {
    if (!invite || accepting) return;
    setAccepting(true);
    setError(null);
    api.invites
      .accept(invite.token)
      .then((group) => {
        onNavigate({ page: 'groupDetail', groupId: group.id });
      })
      .catch((err: Error & { code?: string }) => {
        if (err.code === 'PAYMENT_METHOD_REQUIRED') {
          onNavigate('account');
          return;
        }
        setError(err instanceof Error ? err.message : 'Could not accept invite');
      })
      .finally(() => setAccepting(false));
  };

  const handleDecline = () => {
    if (!invite || declining) return;
    setDeclining(true);
    setError(null);
    api.invites
      .decline(invite.token)
      .then(() => {
        onNavigate('home');
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Could not decline');
      })
      .finally(() => setDeclining(false));
  };

  if (loading) {
    return (
      <div className={`h-[calc(100vh-48px-24px)] flex items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
        <Loader size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className={`h-[calc(100vh-48px-24px)] flex flex-col items-center justify-center px-6 ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
        <AlertCircle size={48} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
        <p className={`text-center mt-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{error}</p>
        <button
          onClick={() => onNavigate('home')}
          className={`mt-6 px-6 py-3 rounded-xl font-medium ${isDark ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-800'}`}
        >
          Go to Home
        </button>
      </div>
    );
  }

  if (!invite) return null;

  return (
    <div className={`h-[calc(100vh-48px-24px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-b px-5 py-4`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('home')}
            className={`w-9 h-9 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-100'} flex items-center justify-center active:scale-95 transition-transform`}
          >
            <ChevronLeft size={20} className={isDark ? 'text-white' : 'text-slate-800'} strokeWidth={2.5} />
          </button>
          <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Group Invite</h1>
        </div>
      </motion.div>

      <div className="flex-1 overflow-y-auto px-5 py-8">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-2xl p-6 shadow-lg text-center`}
        >
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mx-auto mb-4">
            <UserPlus size={32} className="text-white" />
          </div>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'} mb-1`}>
            {invite.inviterName} invited you to join
          </p>
          <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'} mb-2`}>
            {invite.groupName}
          </h2>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Add a payment method in Account if you haven’t already. You’ll need one to join.
          </p>
        </motion.div>

        {error && (
          <p className={`text-center text-red-500 text-sm mt-4`}>{error}</p>
        )}

        <div className="mt-8 flex flex-col gap-3">
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-xl font-semibold disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {accepting ? <Loader size={20} className="animate-spin" /> : null}
            {accepting ? 'Joining...' : 'Accept Invite'}
          </button>
          <button
            onClick={handleDecline}
            disabled={declining}
            className={`w-full py-4 rounded-xl font-medium ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'} disabled:opacity-70`}
          >
            {declining ? 'Declining...' : 'Decline'}
          </button>
        </div>
      </div>
    </div>
  );
}
