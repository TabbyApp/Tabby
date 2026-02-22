import { motion } from 'motion/react';
import { ChevronLeft, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { BottomNavigation } from './BottomNavigation';
import { ProfileSheet } from './ProfileSheet';
import { PageType } from '../App';
import { useSocket } from '../contexts/SocketContext';
import { api } from '../lib/api';

interface ActivityPageProps {
  onNavigate: (page: PageType, groupId?: string) => void;
  theme: 'light' | 'dark';
}

export function ActivityPage({ onNavigate, theme }: ActivityPageProps) {
  const isDark = theme === 'dark';
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [transactions, setTransactions] = useState<
    { id: string; description: string; group: string; amount: number; date: string; type: 'paid' | 'received' }[]
  >([]);
  const [loading, setLoading] = useState(true);

  const fetchActivity = useCallback((): Promise<void> => {
    return Promise.all([
      api.transactions.activity().catch(() => []),
      api.receipts.mySplits().catch(() => []),
    ]).then(([activity, splits]) => {
      const txItems = activity.map((a: { id: string; group_name: string; amount: number; created_at: string }) => {
        const date = new Date(a.created_at);
        const now = new Date();
        const diffH = Math.floor((now.getTime() - date.getTime()) / 3600000);
        const timeAgo = diffH < 1 ? 'just now' : diffH < 24 ? `${diffH}h ago` : `${Math.floor(diffH / 24)}d ago`;
        return {
          id: a.id,
          description: a.group_name,
          group: a.group_name,
          amount: a.amount,
          date: timeAgo,
          type: 'paid' as const,
        };
      });
      const splitItems = splits.map((s: { id: string; group_name: string; amount: number; created_at: string; status: string }) => {
        const date = new Date(s.created_at);
        const now = new Date();
        const diffH = Math.floor((now.getTime() - date.getTime()) / 3600000);
        const timeAgo = diffH < 1 ? 'just now' : diffH < 24 ? `${diffH}h ago` : `${Math.floor(diffH / 24)}d ago`;
        return {
          id: s.id,
          description: s.group_name,
          group: s.group_name,
          amount: s.amount,
          date: timeAgo,
          type: (s.status === 'settled' ? 'paid' : 'paid') as 'paid' | 'received',
        };
      });
      const combined = [...txItems, ...splitItems].sort((a, b) => {
        return 0;
      });
      setTransactions(combined.length > 0 ? combined : []);
    }).then(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchActivity().finally(() => setLoading(false));
  }, [fetchActivity]);

  const { activityInvalidatedAt } = useSocket();
  useEffect(() => {
    if (activityInvalidatedAt === 0) return;
    fetchActivity();
  }, [activityInvalidatedAt, fetchActivity]);

  return (
    <div className={`h-[calc(100vh-48px-24px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50'}`}>
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0 }}
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
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Activity</h1>
        </div>
      </motion.div>

      {/* Activity List */}
      <div className="flex-1 overflow-y-auto px-5 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4`}>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
                  <div className="flex-1 space-y-2">
                    <div className={`h-4 w-24 rounded ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
                    <div className={`h-3 w-32 rounded ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
                  </div>
                  <div className={`h-5 w-16 rounded ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
                </div>
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <p className={`text-center mt-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No activity yet</p>
        ) : (
          <div className="space-y-3">
            {transactions.map((transaction, index) => (
              <motion.div
                key={transaction.id}
                initial={{ x: -6, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.02, duration: 0.12 }}
                className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 shadow-sm`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    transaction.type === 'paid' ? 'bg-red-100' : 'bg-green-100'
                  }`}>
                    {transaction.type === 'paid' ? (
                      <ArrowUpRight size={20} className="text-red-500" strokeWidth={2.5} />
                    ) : (
                      <ArrowDownLeft size={20} className="text-green-500" strokeWidth={2.5} />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>{transaction.description}</h3>
                    <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{transaction.group} • {transaction.date}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-lg ${
                      transaction.type === 'paid' ? 'text-red-500' : 'text-green-500'
                    }`}>
                      {transaction.type === 'paid' ? '-' : '+'}${transaction.amount.toFixed(2)}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <BottomNavigation currentPage="activity" onNavigate={onNavigate} onProfileClick={() => setShowProfileSheet(true)} theme={theme} />
      {showProfileSheet && (
        <ProfileSheet onClose={() => setShowProfileSheet(false)} onNavigateToAccount={() => onNavigate('account')} onNavigateToSettings={() => onNavigate('settings')} onNavigateToWallet={() => onNavigate('wallet')} theme={theme} />
      )}
    </div>
  );
}
