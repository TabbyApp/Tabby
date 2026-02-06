import { motion } from 'motion/react';
import { ChevronLeft, Users, Plus, Search, Clock, Archive } from 'lucide-react';
import { useState } from 'react';
import { PageType } from '../App';

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

  const filteredRecentGroups = recentGroups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayGroups = activeTab === 'active' ? filteredGroups : filteredRecentGroups;

  return (
    <div className={`h-[calc(100vh-48px-24px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
      {/* Header */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border-b px-5 py-5`}
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
        <div className="relative mb-4">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search groups..."
            className={`w-full pl-11 pr-4 py-3.5 ${isDark ? 'bg-slate-700 text-white border-slate-600' : 'bg-white text-slate-900 border-slate-200'} rounded-[18px] text-[15px] border shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all`}
          />
        </div>

        {/* Tab Switcher */}
        <div className={`flex gap-2 ${isDark ? 'bg-slate-700' : 'bg-slate-100'} p-1 rounded-xl`}>
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-2 rounded-lg font-semibold text-sm transition-all ${
              activeTab === 'active'
                ? isDark 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-white text-purple-600 shadow-sm'
                : isDark 
                  ? 'text-slate-400' 
                  : 'text-slate-600'
            }`}
          >
            Active ({groups.length})
          </button>
          <button
            onClick={() => setActiveTab('recent')}
            className={`flex-1 py-2 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'recent'
                ? isDark 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-white text-purple-600 shadow-sm'
                : isDark 
                  ? 'text-slate-400' 
                  : 'text-slate-600'
            }`}
          >
            <Archive size={16} />
            Recent ({recentGroups.length})
          </button>
        </div>
      </motion.div>

      {/* Groups List */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {displayGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className={`w-20 h-20 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'} flex items-center justify-center mb-4`}>
              <Search size={32} className={isDark ? 'text-slate-600' : 'text-slate-400'} />
            </div>
            <p className={`${isDark ? 'text-slate-400' : 'text-slate-500'} text-center`}>
              No groups found for "{searchQuery}"
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayGroups.map((group, index) => (
              <motion.button
                key={group.id}
                onClick={() => activeTab === 'active' ? onNavigate('groupDetail', group.id) : undefined}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.1, duration: 0.4 }}
                className={`w-full ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} rounded-[24px] p-5 shadow-lg ${isDark ? 'shadow-none' : 'shadow-slate-200/50'} ${activeTab === 'active' ? 'active:scale-[0.98]' : 'opacity-60'} transition-transform border`}
              >
                <div className="flex items-center gap-4">
                  <div 
                    className={`w-16 h-16 rounded-[20px] flex items-center justify-center relative`}
                    style={{ backgroundColor: group.color }}
                  >
                    {activeTab === 'recent' && (
                      <div className="absolute inset-0 bg-black/40 rounded-[20px] flex items-center justify-center">
                        <Archive size={24} className="text-white" />
                      </div>
                    )}
                    <Users size={28} className="text-white" strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'} text-[18px] mb-0.5`}>{group.name}</h3>
                    <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'} font-medium`}>
                      {activeTab === 'recent' && 'deletedAt' in group 
                        ? `Deleted ${new Date(group.deletedAt).toLocaleDateString()}`
                        : `${group.members} members`
                      }
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'} text-xl mb-0.5`}>
                      ${group.balance.toFixed(2)}
                    </p>
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-400'} font-medium`}>balance</p>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}
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
          className="w-full bg-purple-600 text-white py-4.5 rounded-[20px] font-bold active:scale-[0.98] transition-transform flex items-center justify-center gap-2.5 text-[17px]"
        >
          <Plus size={26} strokeWidth={2.5} />
          Create New Group
        </button>
      </motion.div>
    </div>
  );
}