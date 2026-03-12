import { useState } from 'react';
import { CreditCard, Users, ArrowRight, Bell } from 'lucide-react';
import { ProfileSheet } from './ProfileSheet';
import { TabbyWordmark } from './TabbyLogo';
import { BottomNavigation } from './BottomNavigation';
import { PageType } from '../App';

interface LandingPageProps {
  onNavigate: (page: PageType, groupId?: string) => void;
  theme: 'light' | 'dark';
  groups: Array<{ id: string; name: string; members: number; balance: number; color: string; createdBy: string }>;
  recentGroups: Array<{ id: string; name: string; members: number; balance: number; color: string; createdBy: string }>;
  unreadNotificationCount: number;
  pendingInvites: Array<{ id: string; groupName: string; inviterName: string; members: number }>;
  acceptInvite: (inviteId: string) => void | Promise<void>;
  declineInvite: (inviteId: string) => void | Promise<void>;
  preloadedCardInfo?: { lastFour: string; balance: number; groupId?: string } | null;
}

export function LandingPage({ onNavigate, theme, groups, recentGroups = [], unreadNotificationCount, pendingInvites, acceptInvite, declineInvite, preloadedCardInfo }: LandingPageProps) {
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const cardInfo = preloadedCardInfo ?? null;

  const activeGroups = groups.slice(0, 3).map(group => ({
    id: group.id,
    name: group.name,
    members: group.members,
    amount: group.balance,
    color: group.color,
  }));

  const totalBalance = cardInfo ? cardInfo.balance : groups.reduce((sum, g) => sum + g.balance, 0);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <div className="px-6 pt-8 pb-6">
        <div className="flex items-center justify-between">
          <TabbyWordmark />
          <button
            onClick={() => onNavigate('notifications')}
            className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center active:scale-95 transition-transform relative"
          >
            <Bell size={18} className="text-foreground" strokeWidth={2} />
            {unreadNotificationCount > 0 && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-destructive rounded-full flex items-center justify-center">
                <span className="text-destructive-foreground text-[10px] font-bold">{unreadNotificationCount}</span>
              </div>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-28">
        {/* Featured Card - show when we have card info or groups */}
        {(cardInfo || groups.length > 0) && (
          <div className="mb-10">
            <button
              onClick={() => (cardInfo?.groupId ? onNavigate('cardDetails', cardInfo.groupId) : onNavigate('wallet'))}
              className="w-full bg-card border border-border rounded-2xl p-6 active:scale-[0.99] transition-all relative overflow-hidden"
            >
              <div className="relative">
                <div className="flex items-start justify-between mb-12">
                  <div className="text-left">
                    <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-2">Virtual Card</p>
                    <p className="text-foreground font-mono text-lg tracking-wide">
                      •••• •••• •••• {cardInfo?.lastFour ?? '----'}
                    </p>
                  </div>
                  <CreditCard size={24} className="text-muted-foreground" strokeWidth={2} />
                </div>
                <div className="flex items-end justify-between">
                  <div className="text-left">
                    <p className="text-muted-foreground text-xs font-semibold mb-1">Total Balance</p>
                    <p className="text-foreground text-3xl font-bold tracking-tight">${totalBalance.toFixed(2)}</p>
                  </div>
                  <div className="bg-secondary text-foreground text-xs font-semibold px-4 py-2 rounded-full">
                    Manage
                  </div>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Active Groups */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Active Groups
            </h2>
            {groups.length > 3 && (
              <button
                onClick={() => onNavigate('groups')}
                className="text-primary text-sm font-semibold hover:opacity-80 transition-opacity"
              >
                See All
              </button>
            )}
          </div>

          {activeGroups.length > 0 ? (
            <div className="space-y-3">
              {activeGroups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => onNavigate('groupDetail', group.id)}
                  className="w-full bg-card border border-border rounded-2xl p-4 active:scale-[0.99] transition-all hover:border-border/80 text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: group.color }}
                      >
                        <Users size={20} className="text-white" strokeWidth={2.5} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-[15px] text-foreground">{group.name}</h3>
                        <p className="text-xs text-muted-foreground">{group.members} members</p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <p className="font-semibold text-base text-foreground">${group.amount.toFixed(2)}</p>
                      <ArrowRight size={16} className="text-muted-foreground" strokeWidth={2} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <Users size={32} className="text-muted-foreground mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-sm text-muted-foreground font-medium mb-2">No active groups</p>
              <p className="text-xs text-muted-foreground mb-4">Create a group to start splitting bills</p>
              <button
                onClick={() => onNavigate('createGroup')}
                className="bg-primary text-primary-foreground text-sm font-semibold px-5 py-2.5 rounded-xl active:scale-[0.98] transition-transform"
              >
                Create Group
              </button>
            </div>
          )}
        </div>

        {/* Recent Groups */}
        {recentGroups.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Recent Groups
              </h2>
              <button
                onClick={() => onNavigate('groups')}
                className="text-primary text-sm font-semibold hover:opacity-80 transition-opacity"
              >
                See All
              </button>
            </div>
            <div className="space-y-3">
              {recentGroups.slice(0, 3).map((group) => (
                <button
                  key={group.id}
                  onClick={() => onNavigate('groupDetail', group.id)}
                  className="w-full bg-card border border-border rounded-2xl p-4 active:scale-[0.99] transition-all opacity-80 hover:opacity-100 text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center relative"
                        style={{ backgroundColor: group.color }}
                      >
                        <div className="absolute inset-0 bg-black/30 rounded-xl" />
                        <Users size={20} className="text-white relative z-10" strokeWidth={2.5} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-[15px] text-foreground">{group.name}</h3>
                        <p className="text-xs text-muted-foreground">{group.members} members · Settled</p>
                      </div>
                    </div>
                    <ArrowRight size={16} className="text-muted-foreground" strokeWidth={2} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pending Invites */}
        {pendingInvites.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
              Pending Invites
            </h2>
            <div className="space-y-3">
              {pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="w-full bg-card border border-border rounded-2xl p-4"
                >
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10">
                      <Users size={20} className="text-primary" strokeWidth={2.5} />
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="font-semibold text-[15px] text-foreground mb-1">{invite.groupName}</h3>
                      <p className="text-sm text-muted-foreground">Invited by {invite.inviterName}</p>
                      {invite.members > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">{invite.members} members</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => acceptInvite(invite.id)}
                      className="flex-1 bg-success text-success-foreground py-3 rounded-xl text-sm font-semibold active:scale-[0.98] transition-transform"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => declineInvite(invite.id)}
                      className="flex-1 bg-secondary text-secondary-foreground py-3 rounded-xl text-sm font-semibold active:scale-[0.98] transition-transform"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showProfileSheet && (
        <ProfileSheet
          onClose={() => setShowProfileSheet(false)}
          onNavigateToAccount={() => onNavigate('account')}
          onNavigateToSettings={() => onNavigate('settings')}
          onNavigateToWallet={() => onNavigate('wallet')}
          theme={theme}
        />
      )}

      <BottomNavigation currentPage="home" onNavigate={onNavigate} onProfileClick={() => setShowProfileSheet(true)} theme={theme} />
    </div>
  );
}
