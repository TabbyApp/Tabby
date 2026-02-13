import { motion } from 'motion/react';
import { ChevronLeft, UserPlus, X, Check } from 'lucide-react';
import { useState } from 'react';
import { PageType } from '../App';

interface CreateGroupPageProps {
  onNavigate: (page: PageType, groupId?: string | number) => void;
  theme: 'light' | 'dark';
  addGroup: (name: string, memberEmails: string[]) => Promise<string>;
}

export function CreateGroupPage({ onNavigate, theme, addGroup }: CreateGroupPageProps) {
  const isDark = theme === 'dark';
  const [groupName, setGroupName] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [step, setStep] = useState<'create' | 'success'>('create');
  const [groupLink, setGroupLink] = useState('');

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
    if (groupName.trim()) {
      try {
        const newGroupId = await addGroup(groupName, members);
        setGroupLink(`${typeof window !== 'undefined' ? window.location.origin : ''}/?invite=...`);
        setStep('success');
      } catch (_) {
        // Error handled by App / API
      }
    }
  };

  const copyLink = () => {
    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(groupLink)
        .then(() => {
          console.log('Link copied to clipboard');
          // In real app, show a toast notification
        })
        .catch((err) => {
          console.error('Failed to copy:', err);
          // Fallback to old method
          fallbackCopyTextToClipboard(groupLink);
        });
    } else {
      // Fallback for older browsers
      fallbackCopyTextToClipboard(groupLink);
    }
  };

  const fallbackCopyTextToClipboard = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      console.log('Link copied using fallback method');
    } catch (err) {
      console.error('Fallback: Unable to copy', err);
    }
    document.body.removeChild(textArea);
  };

  const shareLink = () => {
    if (navigator.share) {
      navigator.share({
        title: `Join ${groupName} on Tabby`,
        text: `Join my payment group on Tabby!`,
        url: groupLink,
      });
    } else {
      copyLink();
    }
  };

  if (step === 'success') {
    return (
      <div className={`h-[calc(100vh-48px-24px)] flex items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50'}`}>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="text-center px-5 w-full max-w-md"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-24 h-24 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 flex items-center justify-center mx-auto mb-6 shadow-xl"
          >
            <Check size={48} className="text-white" strokeWidth={3} />
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'} mb-2`}
          >
            Group Created!
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className={`${isDark ? 'text-slate-400' : 'text-slate-600'} mb-6`}
          >
            Share this link with your friends to join
          </motion.p>
          
          {/* Share Link */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-2xl p-4 mb-4`}
          >
            <div className="flex items-center gap-2">
              <div className={`flex-1 ${isDark ? 'bg-slate-700' : 'bg-slate-100'} rounded-xl px-3 py-2 text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'} font-mono truncate`}>
                {groupLink}
              </div>
              <button
                onClick={copyLink}
                className="px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-medium active:scale-95 transition-transform"
              >
                Copy
              </button>
            </div>
          </motion.div>

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            onClick={shareLink}
            className="w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white py-4 rounded-2xl font-semibold active:scale-[0.98] transition-transform shadow-xl mb-3"
          >
            Share Link
          </motion.button>

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            onClick={() => onNavigate('groups')}
            className={`w-full ${isDark ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'} py-4 rounded-2xl font-semibold active:scale-[0.98] transition-transform`}
          >
            View All Groups
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`h-[calc(100vh-48px-24px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50'}`}>
      {/* Header */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-b px-5 py-4`}
      >
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onNavigate('groups')}
            className={`w-9 h-9 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-100'} flex items-center justify-center active:scale-95 transition-transform`}
          >
            <ChevronLeft size={20} className={isDark ? 'text-white' : 'text-slate-800'} strokeWidth={2.5} />
          </button>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Create Group</h1>
        </div>
      </motion.div>

      <div className="flex-1 overflow-y-auto px-5 py-6">
        {/* Group Name */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <label className={`block text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide mb-3`}>
            Group Name
          </label>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="e.g., Lunch Squad"
            className={`w-full px-4 py-3.5 rounded-xl text-[17px] ${
              isDark 
                ? 'bg-slate-800 text-white border-slate-700' 
                : 'bg-white text-slate-800 border-gray-200'
            } border focus:outline-none focus:ring-2 focus:ring-blue-400`}
          />
        </motion.div>

        {/* Add Members */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <label className={`block text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide mb-3`}>
            Add Members
          </label>
          <div className="flex gap-2 mb-3">
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addMember()}
              placeholder="Enter email address"
              className={`flex-1 px-4 py-3.5 rounded-xl text-[17px] ${
                isDark 
                  ? 'bg-slate-800 text-white border-slate-700' 
                  : 'bg-white text-slate-800 border-gray-200'
              } border focus:outline-none focus:ring-2 focus:ring-blue-400`}
            />
            <button
              onClick={addMember}
              className="w-12 h-12 bg-gradient-to-r from-slate-600 to-blue-500 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
            >
              <UserPlus size={20} className="text-white" strokeWidth={2.5} />
            </button>
          </div>

          {/* Members List */}
          {members.length > 0 && (
            <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl overflow-hidden shadow-sm`}>
              {members.map((email, index) => (
                <div 
                  key={email}
                  className={`flex items-center justify-between p-3 ${
                    index !== members.length - 1 ? `border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}` : ''
                  }`}
                >
                  <p className={`${isDark ? 'text-white' : 'text-slate-800'}`}>{email}</p>
                  <button
                    onClick={() => removeMember(email)}
                    className="p-1 hover:bg-red-100 rounded-full transition-colors"
                  >
                    <X size={18} className="text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Info Box */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className={`${isDark ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-200'} border rounded-xl p-4`}
        >
          <p className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
            💡 Members will receive an invitation to join this group. Once they accept, a virtual card will be generated for group payments.
          </p>
        </motion.div>
      </div>

      {/* Create Button */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="px-5 pb-6"
      >
        <button
          onClick={createGroup}
          disabled={!groupName.trim()}
          className={`w-full py-4 rounded-xl font-semibold shadow-lg transition-all ${
            groupName.trim()
              ? 'bg-gradient-to-r from-slate-600 to-blue-500 text-white active:scale-[0.98]'
              : isDark 
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          Create Group & Generate Card
        </button>
      </motion.div>
    </div>
  );
}