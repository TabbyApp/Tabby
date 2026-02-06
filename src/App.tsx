import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { api, invalidateDashboardCache } from './lib/api';
import { SplashScreen } from './components/SplashScreen';
import { LoginSignup } from './components/LoginSignup';
import { LandingPage } from './components/LandingPage';
import { GroupsPage } from './components/GroupsPage';
import { ActivityPage } from './components/ActivityPage';
import { AccountPage } from './components/AccountPage';
import { SettingsPage } from './components/SettingsPage';
import { VirtualWalletPage } from './components/VirtualWalletPage';
import { CardDetailsPage } from './components/CardDetailsPage';
import { CreateGroupPage } from './components/CreateGroupPage';
import { ReceiptScanPage } from './components/ReceiptScanPage';
import { ReceiptItemsPage } from './components/ReceiptItemsPage';
import { ProcessingPaymentPage } from './components/ProcessingPaymentPage';
import { GroupDetailPage } from './components/GroupDetailPage';
import { NotificationsSettingsPage } from './components/NotificationsSettingsPage';
import { NotificationsPage } from './components/NotificationsPage';
import { PrivacySettingsPage } from './components/PrivacySettingsPage';
import { HelpSupportPage } from './components/HelpSupportPage';
import { AppearanceSettingsPage } from './components/AppearanceSettingsPage';
import { ChangePasswordPage } from './components/ChangePasswordPage';
import { TwoFactorAuthPage } from './components/TwoFactorAuthPage';
import { ForgotPasswordPage } from './components/ForgotPasswordPage';
import { AcceptInvitePage } from './components/AcceptInvitePage';
import { ProAccountPage } from './components/ProAccountPage';

export type PageType = 'home' | 'groups' | 'activity' | 'account' | 'settings' | 
  'wallet' | 'cardDetails' | 'createGroup' | 'receiptScan' | 'receiptItems' | 'processing' |
  'groupDetail' | 'notifications' | 'notificationsSettings' | 'privacySettings' | 'helpSupport' | 
  'appearanceSettings' | 'changePassword' | 'twoFactorAuth' | 'forgotPassword' | 'acceptInvite' | 'proAccount';

const GROUP_COLORS = ['#3B82F6', '#A855F7', '#22C55E', '#F97316', '#EC4899'];

function mapDashboardToGroups(dashboard: { groups: { id: string; name: string; memberCount: number; cardLastFour: string | null; createdAt?: string; createdBy?: string }[] }) {
  return dashboard.groups.map((g, i) => ({
    id: g.id,
    name: g.name,
    members: g.memberCount,
    balance: 0,
    color: GROUP_COLORS[i % GROUP_COLORS.length],
    createdBy: g.createdBy ?? '',
  }));
}

export default function App() {
  const { user, loading: authLoading, login, signup, logout } = useAuth();
  const isAuthenticated = !!user;
  const currentUserId = user?.id ?? '';

  const [showSplash, setShowSplash] = useState(true);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [currentPage, setCurrentPage] = useState<PageType>('home');
  const [themePreference, setThemePreference] = useState<'light' | 'dark' | 'system'>('system');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [acceptInviteToken, setAcceptInviteToken] = useState<string | null>(null);
  const [pageHistory, setPageHistory] = useState<PageType[]>([]);
  const [accountType, setAccountType] = useState<'standard' | 'pro'>('standard');
  const [processingGroupId, setProcessingGroupId] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<{
    members: Array<{ id: number; name: string; amount: number; avatar: string }>;
    total: number;
  } | null>(null);

  // Groups and pending invites from API
  const [groups, setGroups] = useState<Array<{ id: string; name: string; members: number; balance: number; color: string; createdBy: string }>>([]);
  const [pendingInvites, setPendingInvites] = useState<Array<{ id: string; token: string; groupName: string; inviterName: string; members: number }>>([]);
  const [recentGroups, setRecentGroups] = useState<Array<{ id: string; name: string; members: number; balance: number; color: string; createdBy: string; deletedAt: Date }>>([]);

  const loadDashboard = useCallback(() => {
    if (!user) return;
    api.users.dashboard({ revalidate: true }).then((data) => {
      setGroups(mapDashboardToGroups(data));
      setPendingInvites(
        data.pendingInvites.map((inv) => ({
          id: inv.inviteId,
          token: inv.token,
          groupName: inv.groupName,
          inviterName: inv.inviterName,
          members: 0,
        }))
      );
    }).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) {
      setGroups([]);
      setPendingInvites([]);
      return;
    }
    loadDashboard();
  }, [user, loadDashboard]);

  // Open accept-invite from URL (?invite=TOKEN or #invite/TOKEN)
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    const tokenFromQuery = params.get('invite') || params.get('token');
    const hash = window.location.hash.slice(1);
    const tokenFromHash = hash.startsWith('invite/') ? hash.replace('invite/', '') : null;
    const token = tokenFromQuery || tokenFromHash;
    if (token) {
      setAcceptInviteToken(token);
      setCurrentPage('acceptInvite');
    }
  }, [user]);

  const [notifications, setNotifications] = useState([
    { id: 1, type: 'invite', title: 'Group Invitation', message: 'Sarah Mitchell invited you to Weekend Brunch Club', time: '5m ago', read: false },
    { id: 2, type: 'receipt', title: 'New Receipt', message: 'Mike added a receipt to Lunch Squad for $45.80', time: '2h ago', read: false },
    { id: 3, type: 'payment', title: 'Payment Processed', message: 'Your payment of $15.50 to Lunch Squad was successful', time: '1d ago', read: true },
    { id: 4, type: 'group', title: 'Group Update', message: 'Emma Davis joined Office Lunch', time: '2d ago', read: true },
  ]);

  const acceptInvite = (token: string) => {
    setAcceptInviteToken(token);
    setCurrentPage('acceptInvite');
  };

  const declineInviteByToken = (token: string) => {
    api.invites.decline(token).then(() => {
      invalidateDashboardCache();
      loadDashboard();
    }).catch(() => {});
  };

  const unreadNotificationCount = notifications.filter(n => !n.read).length;

  const deleteGroup = (groupId: string) => {
    const groupToDelete = groups.find(g => g.id === groupId);
    if (groupToDelete) {
      setRecentGroups(prev => [...prev, { ...groupToDelete, deletedAt: new Date() }]);
    }
    setGroups(prev => prev.filter(g => g.id !== groupId));
    api.groups.delete(groupId).then(() => {
      invalidateDashboardCache();
      loadDashboard();
    }).catch(() => {
      loadDashboard(); // Revert UI on failure
    });
  };

  const leaveGroup = (groupId: string) => {
    setGroups(prev => prev.filter(g => g.id !== groupId));
    api.groups.leave(groupId).then(() => {
      invalidateDashboardCache();
      loadDashboard();
    }).catch(() => {
      loadDashboard(); // Revert UI on failure
    });
  };

  const addGroup = async (name: string, memberEmails: string[]): Promise<string> => {
    const group = await api.groups.create(name, []);
    await Promise.all(
      memberEmails.filter((e) => e.trim()).map((email) => api.groups.createInvite(group.id, email.trim().toLowerCase()).catch(() => {}))
    );
    invalidateDashboardCache();
    loadDashboard();
    return group.id;
  };

  // Determine actual theme based on preference
  const theme = themePreference === 'system' 
    ? 'light' // In real app, this would check window.matchMedia('(prefers-color-scheme: dark)').matches
    : themePreference;

  const handleNavigate = (page: PageType, groupId?: string | number) => {
    setPageHistory(prev => [...prev, currentPage]);
    setCurrentPage(page);
    const id = groupId !== undefined ? String(groupId) : null;
    if (id !== null) {
      setSelectedGroupId(id);
      if (page === 'receiptScan') {
        setProcessingGroupId(id);
      }
    }
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setThemePreference(newTheme);
  };

  const handleLogout = async () => {
    await logout();
    setCurrentPage('home');
    setPageHistory([]);
    setGroups([]);
    setPendingInvites([]);
    setAcceptInviteToken(null);
  };

  const handleUpgradeToPro = (duration: '1week' | '1month' | '6months' | '1year') => {
    // In real app, this would process payment
    console.log(`Upgrading to Pro for ${duration}`);
    setAccountType('pro');
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-slate-900' : 'bg-black'}`}>
      <div className={`mx-auto max-w-[430px] h-screen ${theme === 'dark' ? 'bg-slate-900' : 'bg-[#F2F2F7]'} relative overflow-hidden`}>
        {/* iOS Status Bar */}
        <div className={`h-12 bg-transparent flex items-end justify-between px-6 pb-1 text-sm font-semibold ${theme === 'dark' ? 'text-white' : ''}`}>
          <span>9:41</span>
          <div className="flex items-center gap-1">
            <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor">
              <path d="M0 2.5C0 1.67157 0.671573 1 1.5 1H2.5C3.32843 1 4 1.67157 4 2.5V9.5C4 10.3284 3.32843 11 2.5 11H1.5C0.671573 11 0 10.3284 0 9.5V2.5Z"/>
              <path d="M5.5 3.5C5.5 2.67157 6.17157 2 7 2H8C8.82843 2 9.5 2.67157 9.5 3.5V9.5C9.5 10.3284 8.82843 11 8 11H7C6.17157 11 5.5 10.3284 5.5 9.5V3.5Z"/>
              <path d="M11 4.5C11 3.67157 11.6716 3 12.5 3H13.5C14.3284 3 15 3.67157 15 4.5V9.5C15 10.3284 14.3284 11 13.5 11H12.5C11.6716 11 11 10.3284 11 9.5V4.5Z"/>
            </svg>
            <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor">
              <path fillRule="evenodd" clipRule="evenodd" d="M8 2.5C5.5 2.5 3.3 3.7 2 5.5C3.3 7.3 5.5 8.5 8 8.5C10.5 8.5 12.7 7.3 14 5.5C12.7 3.7 10.5 2.5 8 2.5ZM1 5.5C2.5 3 5 1 8 1C11 1 13.5 3 15 5.5C13.5 8 11 10 8 10C5 10 2.5 8 1 5.5Z"/>
            </svg>
            <svg width="25" height="12" viewBox="0 0 25 12" fill="currentColor">
              <rect x="0.5" y="0.5" width="22" height="11" rx="2.5" stroke="currentColor" fill="none"/>
              <rect x="2" y="2" width="18" height="8" rx="1" fill="currentColor"/>
              <rect x="23" y="4" width="1.5" height="4" rx="0.5" fill="currentColor"/>
            </svg>
          </div>
        </div>

        {showSplash ? (
          <SplashScreen onComplete={() => setShowSplash(false)} />
        ) : authLoading ? (
          <div className="flex items-center justify-center h-[calc(100vh-48px-24px)]">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : showForgotPassword ? (
          <ForgotPasswordPage onNavigate={handleNavigate} onBack={() => setShowForgotPassword(false)} theme={theme} />
        ) : !isAuthenticated ? (
          <LoginSignup onForgotPassword={() => setShowForgotPassword(true)} />
        ) : (
          <>
            {currentPage === 'home' && <LandingPage 
              onNavigate={handleNavigate} 
              theme={theme} 
              groups={groups} 
              unreadNotificationCount={unreadNotificationCount}
              pendingInvites={pendingInvites}
              acceptInvite={acceptInvite}
              declineInvite={declineInviteByToken}
            />}
            {currentPage === 'groups' && <GroupsPage 
              onNavigate={handleNavigate} 
              theme={theme} 
              groups={groups} 
              recentGroups={recentGroups}
              accountType={accountType}
              deleteGroup={deleteGroup} 
              leaveGroup={leaveGroup} 
              currentUserId={currentUserId} 
            />}
            {currentPage === 'activity' && <ActivityPage onNavigate={handleNavigate} theme={theme} />}
            {currentPage === 'account' && <AccountPage onNavigate={handleNavigate} theme={theme} />}
            {currentPage === 'settings' && <SettingsPage onNavigate={handleNavigate} theme={theme} onThemeChange={handleThemeChange} onLogout={handleLogout} />}
            {currentPage === 'wallet' && <VirtualWalletPage onNavigate={handleNavigate} theme={theme} />}
            {currentPage === 'cardDetails' && <CardDetailsPage onNavigate={handleNavigate} theme={theme} />}
            {currentPage === 'createGroup' && <CreateGroupPage onNavigate={handleNavigate} theme={theme} addGroup={addGroup} />}
            {currentPage === 'receiptScan' && <ReceiptScanPage onNavigate={handleNavigate} theme={theme} />}
            {currentPage === 'receiptItems' && <ReceiptItemsPage 
              onNavigate={handleNavigate} 
              theme={theme} 
              setReceiptData={setReceiptData}
            />}
            {currentPage === 'processing' && <ProcessingPaymentPage 
              onNavigate={handleNavigate} 
              theme={theme} 
              groupId={processingGroupId}
              accountType={accountType}
              deleteGroup={deleteGroup}
              receiptData={receiptData}
            />}
            {currentPage === 'groupDetail' && <GroupDetailPage onNavigate={handleNavigate} theme={theme} groupId={selectedGroupId} groups={groups} deleteGroup={deleteGroup} leaveGroup={leaveGroup} currentUserId={currentUserId} />}
            {currentPage === 'notifications' && <NotificationsPage 
              onNavigate={handleNavigate} 
              theme={theme} 
              notifications={notifications} 
              setNotifications={setNotifications}
              unreadCount={unreadNotificationCount} 
            />}
            {currentPage === 'notificationsSettings' && <NotificationsSettingsPage onNavigate={handleNavigate} theme={theme} />}
            {currentPage === 'privacySettings' && <PrivacySettingsPage onNavigate={handleNavigate} theme={theme} />}
            {currentPage === 'helpSupport' && <HelpSupportPage onNavigate={handleNavigate} theme={theme} />}
            {currentPage === 'appearanceSettings' && <AppearanceSettingsPage onNavigate={handleNavigate} theme={theme} onThemeChange={handleThemeChange} themePreference={themePreference} />}
            {currentPage === 'changePassword' && <ChangePasswordPage onNavigate={handleNavigate} theme={theme} />}
            {currentPage === 'twoFactorAuth' && <TwoFactorAuthPage onNavigate={handleNavigate} theme={theme} />}
            {currentPage === 'acceptInvite' && acceptInviteToken && (
              <AcceptInvitePage
                onNavigate={handleNavigate}
                theme={theme}
                inviteToken={acceptInviteToken}
                onAcceptSuccess={(groupId) => {
                  setAcceptInviteToken(null);
                  invalidateDashboardCache();
                  loadDashboard();
                  handleNavigate('groupDetail', groupId);
                }}
                onDeclineSuccess={() => {
                  setAcceptInviteToken(null);
                  invalidateDashboardCache();
                  loadDashboard();
                  handleNavigate('home');
                }}
              />
            )}
            {currentPage === 'proAccount' && <ProAccountPage onNavigate={handleNavigate} theme={theme} currentPlan={accountType} onUpgrade={handleUpgradeToPro} />}
          </>
        )}

        {/* iOS Home Indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-36 h-1 bg-black rounded-full opacity-40" />
      </div>
    </div>
  );
}