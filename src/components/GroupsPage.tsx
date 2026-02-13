import { ChevronLeft, Users, Plus, Search } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { PageType, PageState } from '../App';

interface GroupsPageProps {
  onNavigate: (page: PageType, groupId?: string | number) => void;
  theme: 'light' | 'dark';
  groups: Array<{ id: string; name: string; members: number; balance: number; color: string; createdBy: string }>;
  recentGroups: Array<{ id: string; name: string; members: number; balance: number; color: string; createdBy: string; deletedAt: Date }>;
  accountType: 'standard' | 'pro';
  deleteGroup: (groupId: string) => void;
  leaveGroup: (groupId: string) => void;
  currentUserId: string;
}

export function GroupsPage({ onNavigate, theme, groups, recentGroups, accountType }: GroupsPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'recent'>('active');
  const isDark = theme === 'dark';

  // Filter groups based on search query
  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => { load(); }, [load]);

  const displayGroups = activeTab === 'active' ? filteredGroups : filteredRecentGroups;

  return (
    <div className={`h-[calc(100vh-48px-24px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
      {/* Header */}
      <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border-b px-5 py-5`}>
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => onNavigate('home')}
            className={`w-11 h-11 rounded-2xl ${isDark ? 'bg-slate-700' : 'bg-slate-100'} flex items-center justify-center active:scale-95 transition-transform`}
          >
            <ChevronLeft size={22} className={isDark ? 'text-white' : 'text-purple-600'} strokeWidth={2.5} />
          </button>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Groups</h1>
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search groups..."
            className={`w-full pl-11 pr-4 py-3.5 ${isDark ? 'bg-slate-700 text-white border-slate-600' : 'bg-slate-50 text-slate-900 border-slate-200'} rounded-2xl text-[15px] border focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-colors`}
          />
        </div>
      </div>

      {/* Groups List */}
      <div className="flex-1 overflow-y-auto px-5 py-5" style={{ WebkitOverflowScrolling: 'touch' }}>
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
            <button
              key={group.id}
              onClick={() => onNavigate({ page: 'groupDetail', groupId: group.id })}
              className={`w-full text-left ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} rounded-2xl p-5 shadow-sm active:scale-[0.98] transition-transform border`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${group.color} flex items-center justify-center shadow-sm`}>
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
            </button>
          ))}
        </div>
      </div>

      {/* Create Group Button */}
      <div className="px-5 pb-7">
        <button
          onClick={() => onNavigate('createGroup')}
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2.5 text-[17px]"
        >
          <Plus size={26} strokeWidth={2.5} />
          Create New Group
        </button>
      </div>
    </div>
  );
}
