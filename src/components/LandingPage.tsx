import { useState, useEffect, useCallback } from 'react';
import { User, CreditCard, Users, Plus, ArrowRight, Receipt } from 'lucide-react';
import { ProfileSheet } from './ProfileSheet';
import { TabbyCatLogo } from './TabbyCatLogo';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import type { PageType, PageState } from '../App';

interface LandingPageProps {
  onNavigate: (target: PageType | PageState) => void;
  theme: 'light' | 'dark';
}

export function LandingPage({ onNavigate, theme }: LandingPageProps) {
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [groups, setGroups] = useState<{ id: string; name: string; memberCount: number; cardLastFour: string | null }[]>([]);
  const [cards, setCards] = useState<{ groupId: string; groupName: string; cardLastFour: string | null; groupTotal: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, logout } = useAuth();

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([api.groups.list(), api.groups.virtualCards()])
      .then(([gList, cList]) => {
        setGroups(gList);
        setCards(cList);
      })
      .catch((err) => {
        setGroups([]);
        setCards([]);
        setError(err instanceof Error ? err.message : 'Couldn\'t load data');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const firstCard = cards[0];
  const isDark = theme === 'dark';

  return (
    <div className={`h-[calc(100vh-48px-24px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
      {/* Header */}
      <div className="px-5 pt-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="scale-50 origin-left">
            <TabbyCatLogo />
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Tabby</h1>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-purple-600'}`}>Awkwardness Ends Here</p>
          </div>
        </div>
        <button
          onClick={() => setShowProfileSheet(true)}
          className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-md active:scale-95 transition-transform"
        >
          <User size={20} strokeWidth={2.5} />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-24" style={{ WebkitOverflowScrolling: 'touch' }}>
        {/* Active Card Section */}
        <div className="mb-6">
          <h2 className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'} uppercase tracking-wider mb-3 px-1`}>
            Active Card
          </h2>
          {error && (
            <div className={`w-full rounded-2xl p-6 mb-4 ${isDark ? 'bg-amber-900/30 border-amber-700' : 'bg-amber-50 border-amber-200'} border`}>
              <p className={`text-sm mb-3 ${isDark ? 'text-amber-200' : 'text-amber-800'}`}>{error}</p>
              <button onClick={load} className="text-sm font-semibold text-amber-600">Retry</button>
            </div>
          )}
          {loading ? (
            <div className={`w-full rounded-2xl p-6 ${isDark ? 'bg-slate-800' : 'bg-slate-200/50'}`}>
              <p className={isDark ? 'text-slate-500' : 'text-slate-600'}>Loading...</p>
            </div>
          ) : firstCard ? (
            <button
              onClick={() => onNavigate({ page: 'groupDetail', groupId: firstCard.groupId })}
              className="w-full bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 rounded-2xl p-6 shadow-lg active:scale-[0.98] transition-transform relative overflow-hidden"
            >
              <div className="relative">
                <div className="flex items-start justify-between mb-10">
                  <div>
                    <p className="text-purple-200 text-xs mb-2 font-medium">Virtual Group Card &middot; {firstCard.groupName}</p>
                    <p className="text-white font-mono text-xl tracking-wide">&bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; {firstCard.cardLastFour || '----'}</p>
                  </div>
                  <CreditCard size={28} className="text-white/80" />
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-purple-200 text-xs mb-1 font-medium">Group Card</p>
                    <p className="text-white text-3xl font-bold">
                      ${(firstCard.groupTotal ?? 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-white/20 text-white text-xs font-semibold px-5 py-2.5 rounded-full border border-white/30">
                    View Details
                  </div>
                </div>
              </div>
            </button>
          ) : (
            <button
              onClick={() => onNavigate('createGroup')}
              className={`w-full rounded-2xl p-6 border-2 border-dashed ${isDark ? 'border-slate-600 bg-slate-800/50' : 'border-slate-300 bg-slate-100/50'} active:scale-[0.98] transition-transform`}
            >
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>No card yet. Create a group to get your first virtual card.</p>
            </button>
          )}
        </div>

        {/* Active Groups */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'} uppercase tracking-wider`}>
              Active Groups
            </h2>
            <button onClick={() => onNavigate('groups')} className="text-purple-600 text-sm font-semibold">See All</button>
          </div>

          <div className="space-y-3">
            {loading && <p className={isDark ? 'text-slate-500' : 'text-slate-600'}>Loading...</p>}
            {!loading && !error && groups.length === 0 && (
              <div className={`rounded-2xl p-8 text-center border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No groups yet. Create one to get started.</p>
                <button onClick={() => onNavigate('createGroup')} className="mt-3 text-purple-600 font-semibold text-sm">Create Group</button>
              </div>
            )}
            {!loading && groups.slice(0, 3).map((group) => (
              <button
                key={group.id}
                onClick={() => onNavigate({ page: 'groupDetail', groupId: group.id })}
                className={`w-full text-left ${isDark ? 'bg-slate-800' : 'bg-white'} rounded-2xl p-5 shadow-sm active:scale-[0.98] transition-transform border ${isDark ? 'border-slate-700' : 'border-slate-100'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-400 to-indigo-600 flex items-center justify-center shadow-sm">
                      <Users size={24} className="text-white" strokeWidth={2.5} />
                    </div>
                    <div>
                      <h3 className={`font-bold text-[17px] ${isDark ? 'text-white' : 'text-slate-900'}`}>{group.name}</h3>
                      <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{group.memberCount} members</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{group.cardLastFour ? `•••• ${group.cardLastFour}` : '—'}</p>
                    <ArrowRight size={18} className={`${isDark ? 'text-slate-600' : 'text-slate-300'} ml-auto`} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'} uppercase tracking-wider mb-3 px-1`}>
            Recent Activity
          </h2>
          <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} rounded-2xl p-8 text-center shadow-sm border`}>
            <div className={`w-16 h-16 ${isDark ? 'bg-slate-700' : 'bg-purple-50'} rounded-2xl flex items-center justify-center mx-auto mb-3`}>
              <Receipt size={28} className={isDark ? 'text-slate-500' : 'text-purple-500'} strokeWidth={2} />
            </div>
            <p className={`${isDark ? 'text-slate-400' : 'text-slate-500'} text-[15px] font-medium`}>No recent transactions</p>
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-28 right-6 z-30">
        <button
          onClick={() => onNavigate('create')}
          className="w-[68px] h-[68px] bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        >
          <Plus size={36} className="text-white" strokeWidth={2.5} />
        </button>
      </div>

      {/* Bottom Navigation */}
      <div className={`fixed bottom-0 left-0 right-0 ${isDark ? 'bg-slate-800' : 'bg-white'} border-t ${isDark ? 'border-slate-700' : 'border-slate-200'} z-20`}>
        <div className="mx-auto max-w-[430px] px-6 pt-3 pb-7">
          <div className="flex items-center justify-around">
            <button onClick={() => onNavigate('wallet')} className="flex flex-col items-center gap-1.5 min-w-[70px]">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <CreditCard size={22} className="text-white" strokeWidth={2.5} />
              </div>
              <span className="text-[11px] text-purple-600 font-bold">Cards</span>
            </button>
            <button onClick={() => onNavigate('groups')} className="flex flex-col items-center gap-1.5 min-w-[70px]">
              <div className={`w-11 h-11 rounded-2xl ${isDark ? 'bg-slate-700' : 'bg-slate-100'} flex items-center justify-center`}>
                <Users size={22} className="text-gray-500" strokeWidth={2.5} />
              </div>
              <span className="text-[11px] text-gray-500 font-medium">Groups</span>
            </button>
            <button onClick={() => onNavigate('activity')} className="flex flex-col items-center gap-1.5 min-w-[70px]">
              <div className={`w-11 h-11 rounded-2xl ${isDark ? 'bg-slate-700' : 'bg-slate-100'} flex items-center justify-center`}>
                <Receipt size={22} className="text-gray-500" strokeWidth={2.5} />
              </div>
              <span className="text-[11px] text-gray-500 font-medium">Activity</span>
            </button>
          </div>
        </div>
      </div>

      {/* Profile Sheet */}
      {showProfileSheet && (
        <ProfileSheet
          onClose={() => setShowProfileSheet(false)}
          onNavigateToAccount={() => onNavigate('account')}
          onNavigateToSettings={() => onNavigate('settings')}
          onNavigateToWallet={() => onNavigate('wallet')}
          onLogout={logout}
          user={user}
        />
      )}
    </div>
  );
}
