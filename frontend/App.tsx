import { useState, useEffect, useCallback } from 'react';
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
import { useAuth } from './contexts/AuthContext';
import { api } from './lib/api';
import { prefetchAllGroupDetails, invalidateGroupCache } from './lib/groupCache';

export type PageType = 'home' | 'groups' | 'activity' | 'account' | 'settings' | 
  'wallet' | 'cardDetails' | 'createGroup' | 'receiptScan' | 'receiptItems' | 'processing' |
  'groupDetail' | 'notifications' | 'notificationsSettings' | 'privacySettings' | 'helpSupport' | 
  'appearanceSettings' | 'changePassword' | 'twoFactorAuth' | 'forgotPassword' | 'acceptInvite' | 'proAccount';

// Group shape used by components - uses real backend string IDs
export interface AppGroup {
  id: string;
  name: string;
  members: number;
  balance: number;
  color: string;
  createdBy: string;
}

const GROUP_COLORS = ['#3B82F6', '#A855F7', '#22C55E', '#F97316', '#EC4899', '#14B8A6', '#F59E0B', '#6366F1'];

export default function App() {
  const { user, loading: authLoading, logout } = useAuth();
  const [splashAnimDone, setSplashAnimDone] = useState(false);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [currentPage, setCurrentPage] = useState<PageType>('home');
  const [themePreference, setThemePreference] = useState<'light' | 'dark' | 'system'>('system');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [pageHistory, setPageHistory] = useState<PageType[]>([]);
  
  const [accountType, setAccountType] = useState<'standard' | 'pro'>('standard');
  const [processingGroupId, setProcessingGroupId] = useState<string | null>(null);
  
  // Track the current transaction being processed
  const [currentTransactionId, setCurrentTransactionId] = useState<string | null>(null);
  
  // Track the latest uploaded receipt ID
  const [lastReceiptId, setLastReceiptId] = useState<string | null>(null);

  const [receiptData, setReceiptData] = useState<{
    members: Array<{ id: number; name: string; amount: number; avatar: string }>;
    total: number;
  } | null>(null);
  
  const [itemSplitData, setItemSplitData] = useState<{
    hasSelectedItems: boolean;
    yourItemsTotal: number;
  }>({ hasSelectedItems: false, yourItemsTotal: 0 });
  
  // Real groups from backend
  const [groups, setGroups] = useState<AppGroup[]>([]);
  
  // Preloaded virtual card info for LandingPage
  const [cardInfo, setCardInfo] = useState<{ lastFour: string; balance: number } | null>(null);

  // Notifications (UI-only for now - no backend endpoint)
  const [notifications, setNotifications] = useState<Array<{
    id: number; type: string; title: string; message: string; time: string; read: boolean;
  }>>([]);
  const [pendingInvites, setPendingInvites] = useState<Array<{
    id: number; groupName: string; inviterName: string; members: number;
  }>>([]);

  const unreadNotificationCount = notifications.filter(n => !n.read).length;

  // Fetch groups from API
  const loadGroups = useCallback(async () => {
    if (!user) return;
    try {
      const apiGroups = await api.groups.list();
      const mapped: AppGroup[] = apiGroups.map((g, i) => ({
        id: g.id,
        name: g.name,
        members: g.memberCount,
        balance: 0,
        color: GROUP_COLORS[i % GROUP_COLORS.length],
        createdBy: '',
      }));
      setGroups(mapped);
    } catch {
      // Keep existing on error
    }
  }, [user]);

  // Preload groups + initial data as soon as auth resolves (while splash is still showing)
  useEffect(() => {
    if (authLoading) return; // Still checking auth, wait
    if (!user) {
      // No user = nothing to preload, mark ready immediately
      setGroups([]);
      setInitialDataLoaded(true);
      return;
    }
    // User is available - preload groups + virtual cards in parallel
    Promise.all([
      api.groups.list().catch(() => []),
      api.groups.virtualCards().catch(() => []),
    ]).then(([apiGroups, cards]) => {
      const mapped: AppGroup[] = (apiGroups as any[]).map((g: any, i: number) => ({
        id: g.id,
        name: g.name,
        members: g.memberCount,
        balance: 0,
        color: GROUP_COLORS[i % GROUP_COLORS.length],
        createdBy: '',
      }));
      setGroups(mapped);
      if (cards.length > 0) {
        const totalBalance = (cards as any[]).reduce((sum: number, c: any) => sum + (c.groupTotal ?? 0), 0);
        setCardInfo({
          lastFour: (cards as any[])[0].cardLastFour ?? '0000',
          balance: totalBalance,
        });
      }
      // Prefetch ALL group details in background so tapping any group is instant
      if (mapped.length > 0) {
        prefetchAllGroupDetails(mapped.map(g => g.id));
      }
    }).finally(() => setInitialDataLoaded(true));
  }, [authLoading, user]);

  const acceptInvite = (inviteId: number) => {
    setPendingInvites(prev => prev.filter(inv => inv.id !== inviteId));
    loadGroups();
  };

  const declineInvite = (inviteId: number) => {
    setPendingInvites(prev => prev.filter(inv => inv.id !== inviteId));
  };

  const deleteGroup = async (groupId: string) => {
    try {
      await api.groups.deleteGroup(groupId);
      invalidateGroupCache(groupId);
      setGroups(prev => prev.filter(g => g.id !== groupId));
    } catch { /* silent */ }
  };

  const leaveGroup = async (groupId: string) => {
    try {
      await api.groups.leaveGroup(groupId);
      invalidateGroupCache(groupId);
      setGroups(prev => prev.filter(g => g.id !== groupId));
    } catch { /* silent */ }
  };

  const theme = themePreference === 'system' ? 'light' : themePreference;

  // Track which pages have been visited to keep them mounted (display:none)
  const [visitedPages, setVisitedPages] = useState<Set<PageType>>(new Set(['home']));

  const handleNavigate = (page: PageType, groupId?: string) => {
    setPageHistory(prev => [...prev, currentPage]);
    setCurrentPage(page);
    setVisitedPages(prev => {
      if (prev.has(page)) return prev;
      const next = new Set(prev);
      next.add(page);
      return next;
    });
    if (groupId !== undefined) {
      setSelectedGroupId(groupId);
      if (page === 'receiptScan') {
        setProcessingGroupId(groupId);
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
  };

  const handleUpgradeToPro = (duration: '1week' | '1month' | '6months' | '1year') => {
    console.log(`Upgrading to Pro for ${duration}`);
    setAccountType('pro');
  };

  const isAuthenticated = !!user;

  // Keep splash visible until: (1) animation is done AND (2) auth resolved AND (3) initial data loaded
  const showSplash = !splashAnimDone || authLoading || !initialDataLoaded;

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-slate-900' : 'bg-black'}`}>
      <div className={`mx-auto max-w-[430px] h-screen ${theme === 'dark' ? 'bg-slate-900' : 'bg-[#F2F2F7]'} relative overflow-hidden`}>
        {showSplash ? (
          <SplashScreen onComplete={() => setSplashAnimDone(true)} />
        ) : showForgotPassword ? (
          <ForgotPasswordPage onNavigate={handleNavigate} onBack={() => setShowForgotPassword(false)} theme={theme} />
        ) : !isAuthenticated ? (
          <LoginSignup onAuthenticate={() => {}} onForgotPassword={() => setShowForgotPassword(true)} />
        ) : (
          <>
            {/* ===== PERSISTENT TAB PAGES (stay mounted once visited, toggled via display) ===== */}
            <div style={{ display: currentPage === 'home' ? 'contents' : 'none' }}>
              <LandingPage 
                onNavigate={handleNavigate} theme={theme} groups={groups} 
                unreadNotificationCount={unreadNotificationCount}
                pendingInvites={pendingInvites} acceptInvite={acceptInvite} declineInvite={declineInvite}
                preloadedCardInfo={cardInfo}
              />
            </div>
            {visitedPages.has('groups') && (
              <div style={{ display: currentPage === 'groups' ? 'contents' : 'none' }}>
                <GroupsPage 
                  onNavigate={handleNavigate} theme={theme} groups={groups}
                  recentGroups={[]} accountType={accountType}
                  deleteGroup={deleteGroup} leaveGroup={leaveGroup} currentUserId={user?.id ?? ''}
                />
              </div>
            )}
            {visitedPages.has('activity') && (
              <div style={{ display: currentPage === 'activity' ? 'contents' : 'none' }}>
                <ActivityPage onNavigate={handleNavigate} theme={theme} />
              </div>
            )}
            {visitedPages.has('account') && (
              <div style={{ display: currentPage === 'account' ? 'contents' : 'none' }}>
                <AccountPage onNavigate={handleNavigate} theme={theme} />
              </div>
            )}

            {/* ===== ON-DEMAND PAGES (mount/unmount as needed) ===== */}
            {currentPage === 'settings' && <SettingsPage onNavigate={handleNavigate} theme={theme} onThemeChange={handleThemeChange} onLogout={handleLogout} />}
            {currentPage === 'wallet' && <VirtualWalletPage onNavigate={handleNavigate} theme={theme} />}
            {currentPage === 'cardDetails' && <CardDetailsPage onNavigate={handleNavigate} theme={theme} />}
            {currentPage === 'createGroup' && <CreateGroupPage 
              onNavigate={handleNavigate} theme={theme} 
              onGroupCreated={loadGroups}
            />}
            {currentPage === 'receiptScan' && <ReceiptScanPage
              onNavigate={handleNavigate} theme={theme}
              realGroupId={processingGroupId}
              onReceiptUploaded={(id) => setLastReceiptId(id)}
            />}
            {currentPage === 'receiptItems' && <ReceiptItemsPage 
              onNavigate={handleNavigate} theme={theme}
              setReceiptData={setReceiptData} setItemSplitData={setItemSplitData}
              receiptId={lastReceiptId} groupId={processingGroupId}
            />}
            {currentPage === 'processing' && <ProcessingPaymentPage 
              onNavigate={handleNavigate} theme={theme}
              groupId={processingGroupId} accountType={accountType}
              transactionId={currentTransactionId}
              receiptData={receiptData} itemSplitData={itemSplitData}
            />}
            {currentPage === 'groupDetail' && <GroupDetailPage 
              onNavigate={handleNavigate} theme={theme}
              groupId={selectedGroupId} groups={groups}
              deleteGroup={deleteGroup} leaveGroup={leaveGroup}
              currentUserId={user?.id ?? ''}
              itemSplitData={itemSplitData} setItemSplitData={setItemSplitData}
              receiptData={receiptData}
              onStartProcessing={(txId) => { setCurrentTransactionId(txId); }}
              onGroupsChanged={loadGroups}
            />}
            {currentPage === 'notifications' && <NotificationsPage 
              onNavigate={handleNavigate} theme={theme}
              notifications={notifications} setNotifications={setNotifications}
              unreadCount={unreadNotificationCount} acceptInvite={acceptInvite} declineInvite={declineInvite}
            />}
            {currentPage === 'notificationsSettings' && <NotificationsSettingsPage onNavigate={handleNavigate} theme={theme} />}
            {currentPage === 'privacySettings' && <PrivacySettingsPage onNavigate={handleNavigate} theme={theme} />}
            {currentPage === 'helpSupport' && <HelpSupportPage onNavigate={handleNavigate} theme={theme} />}
            {currentPage === 'appearanceSettings' && <AppearanceSettingsPage onNavigate={handleNavigate} theme={theme} onThemeChange={handleThemeChange} themePreference={themePreference} />}
            {currentPage === 'changePassword' && <ChangePasswordPage onNavigate={handleNavigate} theme={theme} />}
            {currentPage === 'twoFactorAuth' && <TwoFactorAuthPage onNavigate={handleNavigate} theme={theme} />}
            {currentPage === 'acceptInvite' && <AcceptInvitePage onNavigate={handleNavigate} theme={theme} />}
            {currentPage === 'proAccount' && <ProAccountPage onNavigate={handleNavigate} theme={theme} currentPlan={accountType} onUpgrade={handleUpgradeToPro} />}
          </>
        )}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-36 h-1 bg-black rounded-full opacity-40" />
      </div>
    </div>
  );
}
