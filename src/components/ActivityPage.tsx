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
  const [activities, setActivities] = useState<{ id: string; transaction_id: string; amount: number; status: string; created_at: string; settled_at: string | null; group_id: string; group_name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.transactions.activity()
      .then(setActivities)
      .catch(() => setActivities([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={`h-[calc(100vh-48px-24px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
      {/* Header */}
      <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-b px-5 py-4`}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('home')}
            className={`w-9 h-9 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-100'} flex items-center justify-center active:scale-95 transition-transform`}
          >
            <ChevronLeft size={20} className={isDark ? 'text-white' : 'text-slate-800'} strokeWidth={2.5} />
          </button>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Activity</h1>
        </div>
      </div>

      {/* Activity List */}
      <div className="flex-1 overflow-y-auto px-5 py-4" style={{ WebkitOverflowScrolling: 'touch' }}>
        {loading && <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>Loading...</p>}
        {!loading && activities.length === 0 && (
          <div className={`rounded-xl p-8 text-center ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
            <Receipt size={40} className={`mx-auto mb-3 ${isDark ? 'text-slate-500' : 'text-slate-300'}`} />
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No activity yet. Create a group, pay, and settle to see history here.</p>
          </div>
        )}
        <div className="space-y-3">
          {activities.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate({ page: 'groupDetail', groupId: item.group_id })}
              className={`w-full text-left ${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 shadow-sm active:scale-[0.98] transition-transform`}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center bg-purple-100">
                  <Receipt size={20} className="text-purple-500" strokeWidth={2.5} />
                </div>
                <div className="flex-1">
                  <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>{item.group_name}</h3>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {formatDate(item.settled_at || item.created_at)} &middot; {item.status === 'SETTLED' ? 'Settled' : item.status}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg text-purple-600">${item.amount.toFixed(2)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
