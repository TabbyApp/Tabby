import { motion } from 'motion/react';
import { ChevronLeft, Receipt } from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { PageType, PageState } from '../App';

interface ActivityPageProps {
  onNavigate: (target: PageType | PageState) => void;
  theme: 'light' | 'dark';
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString();
}

export function ActivityPage({ onNavigate, theme }: ActivityPageProps) {
  const isDark = theme === 'dark';
  const [splits, setSplits] = useState<{ id: string; amount: number; status: string; created_at: string; group_name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.receipts.mySplits().then(setSplits).catch(() => setSplits([])).finally(() => setLoading(false));
  }, []);

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
            onClick={() => onNavigate('home')}
            className={`w-9 h-9 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-100'} flex items-center justify-center active:scale-95 transition-transform`}
          >
            <ChevronLeft size={20} className={isDark ? 'text-white' : 'text-slate-800'} strokeWidth={2.5} />
          </button>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Activity</h1>
        </div>
      </motion.div>

      {/* Activity List */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading && <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>Loading...</p>}
        {!loading && splits.length === 0 && (
          <div className={`rounded-xl p-8 text-center ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
            <Receipt size={40} className={`mx-auto mb-3 ${isDark ? 'text-slate-500' : 'text-slate-300'}`} />
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No splits yet. Upload a receipt and complete a split to see activity here.</p>
          </div>
        )}
        <div className="space-y-3">
          {splits.map((split, index) => (
            <motion.div
              key={split.id}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 shadow-sm`}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center bg-purple-100">
                  <Receipt size={20} className="text-purple-500" strokeWidth={2.5} />
                </div>
                <div className="flex-1">
                  <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>{split.group_name}</h3>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{formatDate(split.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className={`font-bold text-lg text-purple-600`}>${split.amount.toFixed(2)}</p>
                  <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{split.status}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}