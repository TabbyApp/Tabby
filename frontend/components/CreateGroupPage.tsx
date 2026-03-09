import { motion } from 'motion/react';
import { ChevronLeft, UserPlus, X, Check } from 'lucide-react';
import { useState } from 'react';
import { BottomNavigation } from './BottomNavigation';
import { ProfileSheet } from './ProfileSheet';
import { PageType } from '../App';
import { api } from '../lib/api';
import { invalidateGroupCache } from '../lib/groupCache';

interface CreateGroupPageProps {
  onNavigate: (page: PageType, groupId?: string) => void;
  theme: 'light' | 'dark';
  onGroupCreated?: () => void;
}

export function CreateGroupPage({ onNavigate, theme, onGroupCreated }: CreateGroupPageProps) {
  const [groupName, setGroupName] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [step, setStep] = useState<'create' | 'success'>('create');
  const [groupLink, setGroupLink] = useState('');
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const addMember = () => {
    if (emailInput.trim() && !members.includes(emailInput.trim())) {
      setMembers([...members, emailInput.trim()]);
      setEmailInput('');
    }
  };

  const removeMember = (email: string) => {
    setMembers(members.filter(m => m !== email));
  };

  const createGroup = async () => {
    if (groupName.trim() && !creating) {
      setCreating(true);
      setError('');
      try {
        const result = await api.groups.create(groupName, members.length > 0 ? members : undefined);
        setCreatedGroupId(result.id);
        // Same invite link format as GroupDetailPage: /join/:inviteToken
        const token = result.inviteToken ?? (await api.groups.get(result.id)).inviteToken;
        setGroupLink(token ? `${window.location.origin}/join/${token}` : `${window.location.origin}/groups/${result.id}`);
        // Refresh the groups list in App.tsx
        onGroupCreated?.();
        setStep('success');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to create group';
        if (msg.includes('bank')) {
          setError('Please link a bank account first (go to Account page).');
        } else {
          setError(msg);
        }
      } finally {
        setCreating(false);
      }
    }
  };

  const copyLink = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(groupLink).catch(() => {
        fallbackCopyTextToClipboard(groupLink);
      });
    } else {
      fallbackCopyTextToClipboard(groupLink);
    }
  };

  const fallbackCopyTextToClipboard = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try { document.execCommand('copy'); } catch {}
    document.body.removeChild(textArea);
  };

  const shareLink = () => {
    if (navigator.share) {
      navigator.share({ title: `Join ${groupName} on Tabby`, text: `Join my payment group on Tabby!`, url: groupLink });
    } else {
      copyLink();
    }
  };

  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-5 py-8">
        <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }} className="text-center w-full max-w-md">
          <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }} className="w-24 h-24 rounded-full bg-primary flex items-center justify-center mx-auto mb-6 shadow-xl">
            <Check size={48} className="text-primary-foreground" strokeWidth={3} />
          </motion.div>
          <motion.h2 initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12 }} className="text-2xl font-bold text-foreground mb-2">Group Created!</motion.h2>
          <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12 }} className="text-muted-foreground mb-6">Share this link with your friends to join</motion.p>

          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12 }} className="bg-card border border-border rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-secondary rounded-xl px-3 py-2 text-sm text-foreground font-mono truncate">{groupLink}</div>
              <button onClick={copyLink} className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-medium active:scale-95 transition-transform">Copy</button>
            </div>
          </motion.div>

          <motion.button initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12 }} onClick={shareLink} className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-semibold active:scale-[0.98] transition-transform shadow-xl mb-3">Share Link</motion.button>
          {createdGroupId && (
            <motion.button initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12 }} onClick={() => { invalidateGroupCache(createdGroupId); onNavigate('groupDetail', createdGroupId); }} className="w-full bg-card border border-border text-foreground py-4 rounded-2xl font-semibold active:scale-[0.98] transition-transform mb-3">Go to group</motion.button>
          )}
          <motion.button initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12 }} onClick={() => onNavigate('groups')} className="w-full bg-secondary text-secondary-foreground py-4 rounded-2xl font-semibold active:scale-[0.98] transition-transform">View All Groups</motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-card border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('groups')} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center active:scale-95 transition-transform">
            <ChevronLeft size={20} className="text-foreground" strokeWidth={2.5} />
          </button>
          <h1 className="text-2xl font-bold text-foreground">Create Group</h1>
        </div>
      </motion.div>

      <div className="flex-1 overflow-y-auto px-5 py-6" style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}>
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="mb-6">
          <label className="block text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Group Name</label>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="e.g., Lunch Squad"
            className="w-full px-4 py-3.5 rounded-xl text-[17px] bg-secondary text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="mb-6">
          <label className="block text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Add Members</label>
          <div className="flex gap-2 mb-3">
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addMember()}
              placeholder="Enter email address"
              className="flex-1 px-4 py-3.5 rounded-xl text-[17px] bg-secondary text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            <button onClick={addMember} className="w-12 h-12 bg-primary text-primary-foreground rounded-xl flex items-center justify-center active:scale-95 transition-transform">
              <UserPlus size={20} strokeWidth={2.5} />
            </button>
          </div>
          {members.length > 0 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {members.map((email, index) => (
                <div key={email} className={`flex items-center justify-between p-3 ${index !== members.length - 1 ? 'border-b border-border' : ''}`}>
                  <p className="text-foreground">{email}</p>
                  <button onClick={() => removeMember(email)} className="p-1 rounded-full transition-colors hover:bg-destructive/10">
                    <X size={18} className="text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-xl mb-4 border border-destructive/20">
            {error}
          </motion.div>
        )}

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="bg-secondary border border-border rounded-xl p-4 mb-6">
          <p className="text-sm text-muted-foreground">
            Members will receive an invitation to join this group. A virtual card will be generated for group payments.
          </p>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
          <button
            onClick={createGroup}
            disabled={!groupName.trim() || creating}
            className={`w-full py-4 rounded-xl font-semibold transition-all ${
              groupName.trim() && !creating
                ? 'bg-primary text-primary-foreground active:scale-[0.98]'
                : 'bg-secondary text-muted-foreground cursor-not-allowed'
            }`}
          >
            {creating ? 'Creating...' : 'Create Group & Generate Card'}
          </button>
        </motion.div>
      </div>

      <BottomNavigation currentPage="createGroup" onNavigate={onNavigate} onProfileClick={() => setShowProfileSheet(true)} theme={theme} />
      {showProfileSheet && (
        <ProfileSheet onClose={() => setShowProfileSheet(false)} onNavigateToAccount={() => onNavigate('account')} onNavigateToSettings={() => onNavigate('settings')} onNavigateToWallet={() => onNavigate('wallet')} theme={theme} />
      )}
    </div>
  );
}
