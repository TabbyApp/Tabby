import { motion } from 'motion/react';
import { Users, Check, X, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { PageType } from '../App';
import { api } from '../lib/api';

interface AcceptInvitePageProps {
  onNavigate: (page: PageType, groupId?: string) => void;
  theme: 'light' | 'dark';
  inviteCode?: string;
  /** Called after successful join; may return a Promise so joiner can await group list refresh before navigating */
  onAccepted?: () => void | Promise<void>;
}

export function AcceptInvitePage({ onNavigate, theme, inviteCode, onAccepted }: AcceptInvitePageProps) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string>('Group Invitation');

  useEffect(() => {
    if (!inviteCode) return;
    api.groups
      .joinPreview(inviteCode)
      .then((r) => setGroupName(r.groupName))
      .catch(() => setGroupName('Unknown Group'));
  }, [inviteCode]);

  const invite = { groupName };

  const handleAccept = async () => {
    if (!inviteCode) {
      setError('No invite code provided');
      return;
    }
    setIsAccepting(true);
    setError(null);
    try {
      const result = await api.groups.joinByToken(inviteCode);
      await onAccepted?.();
      onNavigate('groupDetail', result.groupId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join group');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDecline = () => {
    setIsDeclining(true);
    onAccepted?.();
    setTimeout(() => {
      setIsDeclining(false);
      onNavigate('home');
    }, 500);
  };

  if (!inviteCode) {
    return (
      <div className="h-[calc(100vh-48px-24px)] flex flex-col items-center justify-center px-5 bg-background">
        <p className="text-muted-foreground">Invalid or expired invite link.</p>
        <button
          onClick={() => onNavigate('home')}
          className="mt-4 text-primary font-semibold"
        >
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-48px-24px)] flex flex-col bg-background">
      <div className="flex-1 flex flex-col items-center justify-center px-5">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="w-full max-w-md"
        >
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }} className="flex justify-center mb-6">
            <div className="w-28 h-28 rounded-[32px] flex items-center justify-center bg-primary/20 border border-border">
              <Users size={56} className="text-primary" strokeWidth={2} />
            </div>
          </motion.div>

          <motion.div initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.12 }} className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">You're Invited!</h1>
            <p className="text-lg text-foreground mb-4">
              Join <span className="font-bold">{invite.groupName}</span>
            </p>
          </motion.div>

          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 mb-4 flex items-center gap-2">
              <AlertCircle size={20} className="text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </motion.div>
          )}

          <motion.div initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.12 }} className="space-y-3">
            <button onClick={handleAccept} disabled={isAccepting || isDeclining}
              className={`w-full py-4 rounded-[20px] font-bold transition-all flex items-center justify-center gap-2.5 text-[17px] ${
                isAccepting || isDeclining ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-primary text-primary-foreground active:scale-[0.98]'
              }`}>
              {isAccepting ? (<><div className="w-5 h-5 border-3 border-primary-foreground border-t-transparent rounded-full animate-spin" />Accepting...</>) : (<><Check size={24} strokeWidth={2.5} />Accept Invitation</>)}
            </button>
            <button onClick={handleDecline} disabled={isAccepting || isDeclining}
              className={`w-full py-4 rounded-[20px] font-bold transition-all flex items-center justify-center gap-2.5 text-[17px] ${
                isAccepting || isDeclining ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-card border border-border text-foreground active:scale-[0.98]'
              }`}>
              {isDeclining ? (<><div className="w-5 h-5 border-3 border-foreground border-t-transparent rounded-full animate-spin" />Declining...</>) : (<><X size={24} strokeWidth={2.5} />Decline</>)}
            </button>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }}
            className="mt-6 text-center text-sm text-muted-foreground">
            <p>By accepting, you'll be able to split bills and track expenses with this group.</p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
