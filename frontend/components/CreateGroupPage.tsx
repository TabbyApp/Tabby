import { motion } from 'motion/react';
import { ChevronLeft, UserPlus, X, Check } from 'lucide-react';
import { useState } from 'react';
import { BottomNavigation } from './BottomNavigation';
import { ProfileSheet } from './ProfileSheet';
import { PageType } from '../App';
import { api } from '../lib/api';

interface CreateGroupPageProps {
  onNavigate: (page: PageType, groupId?: string) => void;
  theme: 'light' | 'dark';
  onGroupCreated?: () => void;
}

export function CreateGroupPage({ onNavigate, theme, onGroupCreated }: CreateGroupPageProps) {
  const isDark = theme === 'dark';
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
      <div className={`h-[calc(100vh-48px-24px)] flex items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50'}`}>
        <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }} className="text-center px-5 w-full max-w-md">
          <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }} className="w-24 h-24 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 flex items-center justify-center mx-auto mb-6 shadow-xl">
            <Check size={48} className="text-white" strokeWidth={3} />
          </motion.div>
          <motion.h2 initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12 }} className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'} mb-2`}>Group Created!</motion.h2>
          <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12 }} className={`${isDark ? 'text-slate-400' : 'text-slate-600'} mb-6`}>Share this link with your friends to join</motion.p>
          
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12 }} className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-2xl p-4 mb-4`}>
            <div className="flex items-center gap-2">
              <div className={`flex-1 ${isDark ? 'bg-slate-700' : 'bg-slate-100'} rounded-xl px-3 py-2 text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'} font-mono truncate`}>{groupLink}</div>
              <button onClick={copyLink} className="px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-medium active:scale-95 transition-transform">Copy</button>
            </div>
          </motion.div>

          <motion.button initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12 }} onClick={shareLink} className="w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white py-4 rounded-2xl font-semibold active:scale-[0.98] transition-transform shadow-xl mb-3">Share Link</motion.button>
          {createdGroupId && (
            <motion.button initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12 }} onClick={() => onNavigate('groupDetail', createdGroupId)} className={`w-full ${isDark ? 'bg-slate-800 text-white border border-slate-600' : 'bg-white text-slate-800 border border-slate-200'} py-4 rounded-2xl font-semibold active:scale-[0.98] transition-transform mb-3`}>Go to group</motion.button>
          )}
          <motion.button initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12 }} onClick={() => onNavigate('groups')} className={`w-full ${isDark ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'} py-4 rounded-2xl font-semibold active:scale-[0.98] transition-transform`}>View All Groups</motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`min-h-[100dvh] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50'}`}>
      {/* Header */}
      <motion.div initial={{ opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-b px-5 py-4`}>
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('groups')} className={`w-9 h-9 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-100'} flex items-center justify-center active:scale-95 transition-transform`}>
            <ChevronLeft size={20} className={isDark ? 'text-white' : 'text-slate-800'} strokeWidth={2.5} />
          </button>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Create Group</h1>
        </div>
      </motion.div>

      <div className="flex-1 overflow-y-auto px-5 py-6" style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}>
        <motion.div initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.12 }} className="mb-6">
          <label className={`block text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide mb-3`}>Group Name</label>
          <input type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g., Lunch Squad"
            className={`w-full px-4 py-3.5 rounded-xl text-[17px] ${isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-white text-slate-800 border-gray-200'} border focus:outline-none focus:ring-2 focus:ring-blue-400`}
          />
        </motion.div>

        <motion.div initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.12 }} className="mb-6">
          <label className={`block text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide mb-3`}>Add Members</label>
          <div className="flex gap-2 mb-3">
            <input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && addMember()} placeholder="Enter email address"
              className={`flex-1 px-4 py-3.5 rounded-xl text-[17px] ${isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-white text-slate-800 border-gray-200'} border focus:outline-none focus:ring-2 focus:ring-blue-400`}
            />
            <button onClick={addMember} className="w-12 h-12 bg-gradient-to-r from-slate-600 to-blue-500 rounded-xl flex items-center justify-center active:scale-95 transition-transform">
              <UserPlus size={20} className="text-white" strokeWidth={2.5} />
            </button>
          </div>
          {members.length > 0 && (
            <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl overflow-hidden shadow-sm`}>
              {members.map((email, index) => (
                <div key={email} className={`flex items-center justify-between p-3 ${index !== members.length - 1 ? `border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}` : ''}`}>
                  <p className={`${isDark ? 'text-white' : 'text-slate-800'}`}>{email}</p>
                  <button onClick={() => removeMember(email)} className="p-1 hover:bg-red-100 rounded-full transition-colors">
                    <X size={18} className="text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-100 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">
            {error}
          </motion.div>
        )}

        <motion.div initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.12 }} className={`${isDark ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-200'} border rounded-xl p-4 mb-6`}>
          <p className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
            Members will receive an invitation to join this group. A virtual card will be generated for group payments.
          </p>
        </motion.div>

        <motion.div initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.12 }}>
          <button onClick={createGroup} disabled={!groupName.trim() || creating}
            className={`w-full py-4 rounded-xl font-semibold shadow-lg transition-all ${
              groupName.trim() && !creating
                ? 'bg-gradient-to-r from-slate-600 to-blue-500 text-white active:scale-[0.98]'
                : isDark ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
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
