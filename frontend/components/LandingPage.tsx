import { useState } from 'react';
import { motion } from 'motion/react';
import { User, CreditCard, Users, Plus, ArrowRight, Receipt, Bell, Home } from 'lucide-react';
import { ProfileSheet } from './ProfileSheet';
import { TabbyLogoFinal } from './TabbyLogoFinal';
import { BottomNavigation } from './BottomNavigation';
import { PageType } from '../App';

interface LandingPageProps {
  onNavigate: (page: PageType, groupId?: string) => void;
  theme: 'light' | 'dark';
  groups: Array<{ id: string; name: string; members: number; balance: number; color: string; createdBy: string }>;
  recentGroups: Array<{ id: string; name: string; members: number; balance: number; color: string; createdBy: string }>;
  unreadNotificationCount: number;
  pendingInvites: Array<{ id: number; groupName: string; inviterName: string; members: number }>;
  acceptInvite: (inviteId: number) => void;
  declineInvite: (inviteId: number) => void;
  preloadedCardInfo?: { lastFour: string; balance: number; groupId?: string } | null;
}

export function LandingPage({ onNavigate, theme, groups, recentGroups = [], unreadNotificationCount, pendingInvites, acceptInvite, declineInvite, preloadedCardInfo }: LandingPageProps) {
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  // Use preloaded card info from App (loaded during splash) - no extra API call needed
  const cardInfo = preloadedCardInfo ?? null;

  const activeGroups = groups.slice(0, 2).map(group => ({
    id: group.id,
    name: group.name,
    members: group.members,
    amount: group.balance,
    color: group.color,
  }));

  const isDark = theme === 'dark';

  return (
    <div className={`h-[calc(100vh-48px-24px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
        className="px-5 pt-6 pb-4 flex items-center justify-between"
      >
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <TabbyLogoFinal />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent" style={{ fontFamily: 'ui-rounded, "SF Pro Rounded", system-ui' }}>
              Tabby
            </h1>
          </div>
        </div>
        <button
          onClick={() => onNavigate('notifications')}
          className={`w-11 h-11 rounded-full ${isDark ? 'bg-slate-800' : 'bg-white'} flex items-center justify-center active:scale-95 transition-transform relative`}
        >
          <Bell size={20} className={isDark ? 'text-white' : 'text-slate-800'} strokeWidth={2.5} />
          {unreadNotificationCount > 0 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">{unreadNotificationCount}</span>
            </div>
          )}
        </button>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-24">
        {/* Active Card Section - only when user has groups */}
        {cardInfo && (
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="mb-6"
          >
            <h2 className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'} uppercase tracking-wider mb-3 px-1`}>
              Active Card
            </h2>
            <button 
              onClick={() => cardInfo?.groupId && onNavigate('cardDetails', cardInfo.groupId)}
              className="w-full bg-purple-600 rounded-[20px] p-6 active:scale-[0.98] transition-transform relative overflow-hidden"
            >
              <div className="relative">
                <div className="flex items-start justify-between mb-10">
                  <div>
                    <p className="text-purple-200 text-xs mb-2 font-medium">Virtual Group Card</p>
                    <p className="text-white font-mono text-xl tracking-wide">
                      •••• •••• •••• {cardInfo?.lastFour ?? '----'}
                    </p>
                  </div>
                  <CreditCard size={28} className="text-white/80" />
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-purple-200 text-xs mb-1 font-medium">Group Balance</p>
                    <p className="text-white text-3xl font-bold">
                      ${(cardInfo?.balance ?? 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-white text-purple-600 text-xs font-bold px-5 py-2.5 rounded-full">
                    View Details
                  </div>
                </div>
              </div>
            </button>
          </motion.div>
        )}

        {/* Active Groups */}
        <motion.div
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.2, delay: 0.05 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'} uppercase tracking-wider`}>
              Active Groups
            </h2>
            <button 
              onClick={() => onNavigate('groups')}
              className="text-purple-600 text-sm font-semibold"
            >
              See All
            </button>
          </div>
          
          {activeGroups.length === 0 ? (
            <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-[24px] p-8 text-center border ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
              <Users size={32} className={isDark ? 'text-slate-600' : 'text-slate-300'} />
              <p className={`mt-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No active groups yet</p>
              <button
                onClick={() => onNavigate('createGroup')}
                className="mt-4 bg-purple-600 text-white px-6 py-2.5 rounded-full font-semibold text-sm active:scale-95 transition-transform"
              >
                Create a Group
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {activeGroups.map((group, index) => (
                <motion.button
                  key={group.id}
                  onClick={() => onNavigate('groupDetail', group.id)}
                  initial={{ x: -8, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.03, duration: 0.15 }}
                  className={`w-full ${isDark ? 'bg-slate-800' : 'bg-white'} rounded-[24px] p-5 shadow-lg ${isDark ? 'shadow-none' : 'shadow-slate-200/50'} active:scale-[0.98] transition-transform border ${isDark ? 'border-slate-700' : 'border-slate-100'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-14 h-14 rounded-[18px] flex items-center justify-center shadow-lg"
                        style={{ backgroundColor: group.color }}
                      >
                        <Users size={24} className="text-white" strokeWidth={2.5} />
                      </div>
                      <div>
                        <h3 className={`font-bold text-[17px] ${isDark ? 'text-white' : 'text-slate-900'} text-left`}>{group.name}</h3>
                        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'} text-left`}>{group.members} members</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>${group.amount.toFixed(2)}</p>
                      <ArrowRight size={18} className={`${isDark ? 'text-slate-600' : 'text-slate-300'} ml-auto`} />
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </motion.div>

        {/* Recent Groups */}
        {recentGroups.length > 0 && (
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.2, delay: 0.06 }}
            className="mb-6"
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'} uppercase tracking-wider`}>
                Recent Groups
              </h2>
              <button 
                onClick={() => onNavigate('groups')}
                className="text-purple-600 text-sm font-semibold"
              >
                See All
              </button>
            </div>
            <div className="space-y-3">
              {recentGroups.slice(0, 2).map((group, index) => (
                <motion.button
                  key={group.id}
                  onClick={() => onNavigate('groupDetail', group.id)}
                  initial={{ x: -8, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.03, duration: 0.15 }}
                  className={`w-full ${isDark ? 'bg-slate-800' : 'bg-white'} rounded-[24px] p-5 shadow-lg ${isDark ? 'shadow-none' : 'shadow-slate-200/50'} active:scale-[0.98] transition-transform border opacity-80 ${isDark ? 'border-slate-700' : 'border-slate-100'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-14 h-14 rounded-[18px] flex items-center justify-center shadow-lg relative"
                        style={{ backgroundColor: group.color }}
                      >
                        <div className="absolute inset-0 bg-black/30 rounded-[18px]" />
                        <Users size={24} className="text-white relative z-10" strokeWidth={2.5} />
                      </div>
                      <div>
                        <h3 className={`font-bold text-[17px] ${isDark ? 'text-white' : 'text-slate-900'} text-left`}>{group.name}</h3>
                        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'} text-left`}>{group.members} members · Settled</p>
                      </div>
                    </div>
                    <ArrowRight size={18} className={`${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Pending Invites */}
        {pendingInvites.length > 0 && (
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.2, delay: 0.08 }}
            className="mb-6"
          >
            <h2 className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'} uppercase tracking-wider mb-3 px-1`}>
              Pending Invites
            </h2>
            <div className="space-y-3">
              {pendingInvites.map((invite, index) => (
                <motion.div
                  key={invite.id}
                  initial={{ x: -8, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.03, duration: 0.15 }}
                  className={`w-full ${isDark ? 'bg-slate-800' : 'bg-white'} rounded-[24px] p-5 shadow-lg ${isDark ? 'shadow-none' : 'shadow-slate-200/50'} border ${isDark ? 'border-slate-700' : 'border-slate-100'}`}
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-14 h-14 rounded-[18px] flex items-center justify-center shadow-lg" style={{ backgroundColor: '#FF6F61' }}>
                      <Users size={24} className="text-white" strokeWidth={2.5} />
                    </div>
                    <div className="flex-1">
                      <h3 className={`font-bold text-[17px] ${isDark ? 'text-white' : 'text-slate-900'} mb-1`}>{invite.groupName}</h3>
                      <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Invited by {invite.inviterName}</p>
                      <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'} mt-1`}>{invite.members} members</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => acceptInvite(invite.id)} className="flex-1 bg-green-500 text-white py-3 rounded-xl font-semibold active:scale-[0.98] transition-transform">Accept</button>
                    <button onClick={() => declineInvite(invite.id)} className={`flex-1 ${isDark ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'} py-3 rounded-xl font-semibold active:scale-[0.98] transition-transform`}>Decline</button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
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
