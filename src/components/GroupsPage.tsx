import { motion } from 'motion/react';
import { ChevronLeft, Users, Plus, Search } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { PageType, PageState } from '../App';

interface GroupsPageProps {
  onNavigate: (target: PageType | PageState) => void;
  theme: 'light' | 'dark';
}

const COLORS = ['from-blue-400 to-blue-600', 'from-purple-400 to-purple-600', 'from-green-400 to-green-600', 'from-orange-400 to-orange-600'];

export function GroupsPage({ onNavigate, theme }: GroupsPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [groups, setGroups] = useState<{ id: string; name: string; memberCount: number; cardLastFour: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isDark = theme === 'dark';

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.groups
      .list()
      .then(setGroups)
      .catch((err) => {
        setGroups([]);
        setError(err instanceof Error ? err.message : 'Couldn\'t load groups');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const allGroups = groups.map((g, i) => ({
    ...g,
    members: g.memberCount,
    balance: 0,
    color: COLORS[i % COLORS.length],
  })).filter((g) => !searchQuery || g.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className={`h-[calc(100vh-48px-24px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50'}`}>
      {/* Header */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white/80 border-slate-200'} backdrop-blur-xl border-b px-5 py-5`}
      >
        <div className="flex items-center gap-3 mb-4">
          <button 
            onClick={() => onNavigate('home')}
            className={`w-11 h-11 rounded-[16px] ${isDark ? 'bg-slate-700' : 'bg-gradient-to-br from-purple-100 to-indigo-100'} flex items-center justify-center active:scale-95 transition-transform shadow-sm`}
          >
            <ChevronLeft size={22} className={isDark ? 'text-white' : 'text-purple-600'} strokeWidth={2.5} />
          </button>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Groups</h1>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search groups..."
            className={`w-full pl-11 pr-4 py-3.5 ${isDark ? 'bg-slate-700 text-white border-slate-600' : 'bg-white text-slate-900 border-slate-200'} rounded-[18px] text-[15px] border shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all`}
          />
        </div>
      </motion.div>

      {/* Groups List */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="space-y-3">
          {error && (
            <div className={`rounded-xl p-4 mb-4 ${isDark ? 'bg-amber-900/30 border-amber-700' : 'bg-amber-50 border-amber-200'} border`}>
              <p className={`text-sm mb-3 ${isDark ? 'text-amber-200' : 'text-amber-800'}`}>{error}</p>
              <button onClick={load} className="text-sm font-semibold text-amber-600">Retry</button>
            </div>
          )}
          {loading && <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>Loading groups...</p>}
          {!loading && !error && allGroups.length === 0 && (
            <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>No groups yet. Create one!</p>
          )}
          {allGroups.map((group, index) => (
            <motion.div
              key={group.id}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
              onClick={() => onNavigate({ page: 'groupDetail', groupId: group.id })}
              className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} rounded-[24px] p-5 shadow-lg ${isDark ? 'shadow-none' : 'shadow-slate-200/50'} active:scale-[0.98] transition-transform border cursor-pointer`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-[20px] bg-gradient-to-br ${group.color} flex items-center justify-center shadow-lg shadow-purple-200/40`}>
                  <Users size={28} className="text-white" strokeWidth={2.5} />
                </div>
                <div className="flex-1">
                  <h3 className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'} text-[18px] mb-0.5`}>{group.name}</h3>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'} font-medium`}>{group.members} members</p>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'} text-sm mb-0.5`}>
                    {group.cardLastFour ? `•••• ${group.cardLastFour}` : '—'}
                  </p>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-400'} font-medium`}>card</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Create Group Button */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="px-5 pb-7"
      >
        <button 
          onClick={() => onNavigate('createGroup')}
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4.5 rounded-[20px] font-bold shadow-2xl shadow-purple-400/50 active:scale-[0.98] transition-transform flex items-center justify-center gap-2.5 text-[17px]"
        >
          <Plus size={26} strokeWidth={2.5} />
          Create New Group
        </button>
      </motion.div>
    </div>
  );
}