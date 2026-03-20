import { ChevronLeft, Users, Plus, Search, Archive } from 'lucide-react';
import { useState } from 'react';
import { BottomNavigation } from './BottomNavigation';
import { ProfileSheet } from './ProfileSheet';
import { PageType } from '../App';

interface GroupsPageProps {
  onNavigate: (page: PageType, groupId?: string) => void;
  theme: 'light' | 'dark';
  groups: Array<{ id: string; name: string; members: number; balance: number; color: string; createdBy: string }>;
  recentGroups: Array<{ id: string; name: string; members: number; balance: number; color: string; createdBy: string; deletedAt?: Date }>;
  accountType: 'standard' | 'pro';
  deleteGroup: (groupId: string) => void;
  leaveGroup: (groupId: string) => void;
  currentUserId: string;
}

export function GroupsPage({ onNavigate, theme, groups, recentGroups, accountType }: GroupsPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'recent'>('active');
  const [showProfileSheet, setShowProfileSheet] = useState(false);

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRecentGroups = recentGroups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayGroups = activeTab === 'active' ? filteredGroups : filteredRecentGroups;

  return (
    <div className="h-full min-h-0 flex flex-col bg-background">
      <div className="bg-card border-b border-border px-6 py-6 flex-shrink-0 z-10">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => onNavigate('home')}
            className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center active:scale-95 transition-transform"
          >
            <ChevronLeft size={20} className="text-foreground" strokeWidth={2.5} />
          </button>
          <h1 className="text-2xl font-bold text-foreground">Groups</h1>
        </div>

        <div className="relative mb-5">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" strokeWidth={2} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search groups..."
            className="w-full pl-11 pr-4 py-3 bg-secondary text-foreground rounded-xl text-[15px] border border-transparent focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex gap-1 bg-secondary p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all ${
              activeTab === 'active' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            Active ({groups.length})
          </button>
          <button
            onClick={() => setActiveTab('recent')}
            className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'recent' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            <Archive size={14} strokeWidth={2.5} />
            Recent ({recentGroups.length})
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]">
        {displayGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
              {searchQuery ? (
                <Search size={28} className="text-muted-foreground" strokeWidth={2} />
              ) : (
                <Users size={28} className="text-muted-foreground" strokeWidth={2} />
              )}
            </div>
            <p className="text-foreground font-semibold mb-1">
              {searchQuery ? 'No groups found' : activeTab === 'active' ? 'No active groups' : 'No recent groups'}
            </p>
            <p className="text-sm text-muted-foreground text-center max-w-[240px]">
              {searchQuery
                ? `No groups matching "${searchQuery}"`
                : activeTab === 'active'
                  ? 'Create a group to start splitting bills'
                  : 'Recently settled groups will appear here'}
            </p>
            {activeTab === 'active' && !searchQuery && (
              <button
                onClick={() => onNavigate('createGroup')}
                className="mt-6 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold text-sm active:scale-95 transition-transform"
              >
                Create Group
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-6">
              {displayGroups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => onNavigate('groupDetail', group.id)}
                  className={`w-full bg-card border border-border rounded-2xl p-4 text-left ${
                    activeTab === 'active'
                      ? 'active:scale-[0.99] hover:border-border/80'
                      : 'opacity-70 active:scale-[0.99] hover:border-border/80'
                  } transition-all`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center relative flex-shrink-0"
                      style={{ backgroundColor: group.color }}
                    >
                      {activeTab === 'recent' && (
                        <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                          <Archive size={20} className="text-white" strokeWidth={2.5} />
                        </div>
                      )}
                      <Users size={24} className="text-white relative z-10" strokeWidth={2.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground text-[15px] mb-0.5 truncate">{group.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {activeTab === 'recent' && 'deletedAt' in group && group.deletedAt
                          ? `Deleted ${new Date(group.deletedAt).toLocaleDateString()}`
                          : `${group.members} members`}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-semibold text-foreground text-base">${group.balance.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">balance</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {activeTab === 'active' && (
              <div>
                <button
                  onClick={() => onNavigate('createGroup')}
                  className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-semibold active:scale-[0.99] transition-transform flex items-center justify-center gap-2"
                >
                  <Plus size={22} strokeWidth={2.5} />
                  Create New Group
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <BottomNavigation currentPage="groups" onNavigate={onNavigate} onProfileClick={() => setShowProfileSheet(true)} theme={theme} />
      {showProfileSheet && (
        <ProfileSheet 
          onClose={() => setShowProfileSheet(false)} 
          onNavigateToAccount={() => onNavigate('account')}
          onNavigateToSettings={() => onNavigate('settings')}
          onNavigateToWallet={() => onNavigate('wallet')}
          theme={theme}
        />
      )}
    </div>
  );
}
