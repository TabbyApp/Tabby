import { motion } from 'motion/react';
import { ChevronLeft, Building2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { PageType, PageState } from '../App';

interface LinkBankPageProps {
  onNavigate: (target: PageType | PageState) => void;
  theme: 'light' | 'dark';
}

export function LinkBankPage({ onNavigate, theme }: LinkBankPageProps) {
  const isDark = theme === 'dark';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setUser } = useAuth();

  const handleLinkBank = async () => {
    setError('');
    setLoading(true);
    try {
      await api.users.linkBank();
      const me = await api.users.me();
      setUser({ ...me, bank_linked: me.bank_linked });
      onNavigate('home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link bank');
    } finally {
      setLoading(false);
    }
  };

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
            className={`w-9 h-9 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-100'} flex items-center justify-center active:scale-95`}
          >
            <ChevronLeft size={20} className={isDark ? 'text-white' : 'text-slate-800'} strokeWidth={2.5} />
          </button>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Link Bank</h1>
        </div>
      </motion.div>

      <div className="flex-1 flex flex-col items-center justify-center px-5">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center max-w-sm"
        >
          <div className={`w-24 h-24 rounded-full ${isDark ? 'bg-slate-700' : 'bg-purple-100'} flex items-center justify-center mx-auto mb-6`}>
            <Building2 size={48} className={isDark ? 'text-slate-400' : 'text-purple-600'} strokeWidth={2} />
          </div>
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'} mb-2`}>
            Link Your Bank
          </h2>
          <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'} mb-6`}>
            You need to link a bank account to create groups and make payments. For MVP this is a quick stub link.
          </p>
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <button
            onClick={handleLinkBank}
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-xl font-semibold disabled:opacity-60"
          >
            {loading ? 'Linking...' : 'Link Bank (Stub)'}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
