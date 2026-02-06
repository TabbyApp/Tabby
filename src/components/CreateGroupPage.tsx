import { motion } from 'motion/react';
import { ChevronLeft, UserPlus, X, Check } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import type { PageType, PageState } from '../App';

interface CreateGroupPageProps {
  onNavigate: (target: PageType | PageState) => void;
  theme: 'light' | 'dark';
}

export function CreateGroupPage({ onNavigate, theme }: CreateGroupPageProps) {
  const isDark = theme === 'dark';
  const [groupName, setGroupName] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [phoneInput, setPhoneInput] = useState('');
  const [step, setStep] = useState<'create' | 'success'>('create');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const normalizePhoneDisplay = (p: string) => {
    const d = p.replace(/\D/g, '');
    if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    return p;
  };

  const addMember = () => {
    const raw = phoneInput.replace(/\D/g, '');
    if (raw.length >= 10 && !members.some((m) => m.replace(/\D/g, '') === raw)) {
      setMembers([...members, phoneInput.trim()]);
      setPhoneInput('');
    }
  };

  const removeMember = (phone: string) => {
    setMembers(members.filter((m) => m !== phone));
  };

  const createGroup = async () => {
    if (!groupName.trim()) return;
    setError('');
    setLoading(true);
    try {
      const group = await api.groups.create(groupName.trim(), members.length ? members : undefined);
      // Show success with member statuses
      setStep('success');
      setTimeout(() => {
        onNavigate({ page: 'groupDetail', groupId: group.id });
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'success') {
    return (
      <div className={`h-[calc(100vh-48px-24px)] flex items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="text-center px-5"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-6"
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
            className={isDark ? 'text-slate-400' : 'text-slate-600'}
          >
            Your virtual card is being generated...
          </motion.p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`h-[calc(100vh-48px-24px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
      {/* Header */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-b px-5 py-4`}
      >
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onNavigate('create')}
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

        {/* Add Members by Phone */}
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
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addMember())}
              placeholder="Enter phone number"
              className={`flex-1 px-4 py-3.5 rounded-xl text-[17px] ${
                isDark 
                  ? 'bg-slate-800 text-white border-slate-700' 
                  : 'bg-white text-slate-800 border-gray-200'
              } border focus:outline-none focus:ring-2 focus:ring-blue-400`}
            />
            <button
              type="button"
              onClick={addMember}
              className="w-12 h-12 bg-gradient-to-r from-slate-600 to-blue-500 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
            >
              <UserPlus size={20} className="text-white" strokeWidth={2.5} />
            </button>
          </div>

          {members.length > 0 && (
            <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl overflow-hidden shadow-sm`}>
              {members.map((ph, index) => (
                <div
                  key={ph}
                  className={`flex items-center justify-between p-3 ${
                    index !== members.length - 1 ? `border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}` : ''
                  }`}
                >
                  <p className={`${isDark ? 'text-white' : 'text-slate-800'}`}>{normalizePhoneDisplay(ph)}</p>
                  <button
                    type="button"
                    onClick={() => removeMember(ph)}
                    className={`p-1 rounded-full transition-colors ${isDark ? 'hover:bg-slate-700' : 'hover:bg-red-50'}`}
                  >
                    <X size={18} className="text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className={`${isDark ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-200'} border rounded-xl p-4`}
        >
          <p className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
            💡 Add phone numbers of people who already have a Tabby account. They’ll be added directly to the group—no invite needed.
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
          disabled={!groupName.trim() || loading}
          className={`w-full py-4 rounded-xl font-semibold shadow-lg transition-all ${
            groupName.trim() && !loading
              ? 'bg-gradient-to-r from-slate-600 to-blue-500 text-white active:scale-[0.98]'
              : isDark 
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {loading ? 'Creating...' : 'Create Group & Generate Card'}
        </button>
      </motion.div>
    </div>
  );
}
