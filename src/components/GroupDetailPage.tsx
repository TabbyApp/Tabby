import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Users, CreditCard, Upload, Receipt } from 'lucide-react';
import { api } from '../lib/api';
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
  const [group, setGroup] = useState<{ id: string; name: string; members: { id: string; name: string; email: string }[]; cardLastFour: string | null } | null>(null);
  const [receipts, setReceipts] = useState<GroupReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading || !group) {
    return (
      <div className={`h-[calc(100vh-48px-24px)] flex items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
        <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>Loading...</p>
      </div>
    );
  }

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
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{group.name}</h1>
        </div>
        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          {group.members.length} members
        </p>
      </motion.div>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4">
        <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 shadow-sm`}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
              <CreditCard size={20} className="text-white" />
            </div>
            <div>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Virtual Card</p>
              <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                •••• •••• •••• {group.cardLastFour || '----'}
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
          <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide mb-2`}>
            Members
          </h2>
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
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>{m.name}</p>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{m.email}</p>
                </div>
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
      </div>
    </div>
  );
}
