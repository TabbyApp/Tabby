import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
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
  lastSettledAt?: string | null;
  supportCode?: string | null;
}

const GROUP_COLORS = ['#3B82F6', '#A855F7', '#22C55E', '#F97316', '#EC4899', '#14B8A6', '#F59E0B', '#6366F1'];

export default function App() {
  const { user, groups: bootstrapGroups, virtualCards: bootstrapCards, loading: authLoading, logout, refreshBootstrap } = useAuth();
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
  // When true, receipt scan is for even split - return to group after upload (no item selection)
  const [receiptScanForEvenSplit, setReceiptScanForEvenSplit] = useState(false);

  const [receiptData, setReceiptData] = useState<{
    members: Array<{ id: number; name: string; amount: number; avatar: string }>;
    total: number;
  } | null>(null);
  
  const [itemSplitData, setItemSplitData] = useState<{
    hasSelectedItems: boolean;
    yourItemsTotal: number;
    receiptTotal?: number;
    subtotal?: number;
  }>({ hasSelectedItems: false, yourItemsTotal: 0 });
  
  // Real groups from backend
  const [groups, setGroups] = useState<AppGroup[]>([]);
  const [activeGroups, setActiveGroups] = useState<AppGroup[]>([]);
  const [recentGroups, setRecentGroups] = useState<AppGroup[]>([]);
  
  // Preloaded virtual card info for LandingPage
  const [cardInfo, setCardInfo] = useState<{ lastFour: string; balance: number; groupId?: string } | null>(null);

  // Notifications (UI-only for now - no backend endpoint)
  const [notifications, setNotifications] = useState<Array<{
    id: number; type: string; title: string; message: string; time: string; read: boolean;
  }>>([]);
  const [pendingInvites, setPendingInvites] = useState<Array<{
    id: number; groupName: string; inviterName: string; members: number;
  }>>([]);
  const [pendingInviteToken, setPendingInviteToken] = useState<string | null>(null);

  const unreadNotificationCount = notifications.filter(n => !n.read).length;

  // Parse /join/:token from URL on load (invite links)
  useEffect(() => {
    const m = window.location.pathname.match(/^\/join\/([a-f0-9]+)$/i);
    if (m?.[1]) {
      setPendingInviteToken(m[1]);
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const handlePostAuth = useCallback(() => {
    // Auth completed; AuthContext already updated user state
  }, []);

  // Fetch groups (uses bootstrap - single request)
  const loadGroups = useCallback(async () => {
    if (!user) return;
    try {
      await refreshBootstrap();
    } catch {
      // Keep existing on error
    }
  }, [user, refreshBootstrap]);

  // Use bootstrap data (user + groups + virtualCards) - no extra fetch after login/refresh
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setGroups([]);
      setCardInfo(null);
      setInitialDataLoaded(true);
      return;
    }
    const FIFTEEN_MIN_MS = 15 * 60 * 1000;
    const mapped: AppGroup[] = bootstrapGroups.map((g, i) => ({
      id: g.id,
      name: g.name,
      members: g.memberCount,
      balance: 0,
      color: GROUP_COLORS[i % GROUP_COLORS.length],
      createdBy: '',
      lastSettledAt: (g as { lastSettledAt?: string | null }).lastSettledAt ?? null,
      supportCode: (g as { supportCode?: string | null }).supportCode ?? null
    }));
    setGroups(mapped);
    // Split active vs recent: settled > 15 min ago → recent
    const activeGroups = mapped.filter((g) => {
      const ls = g.lastSettledAt;
      if (!ls) return true;
      return Date.now() - new Date(ls).getTime() < FIFTEEN_MIN_MS;
    });
    const recentGroupsList = mapped.filter((g) => {
      const ls = g.lastSettledAt;
      if (!ls) return false;
      return Date.now() - new Date(ls).getTime() >= FIFTEEN_MIN_MS;
    });
    setActiveGroups(activeGroups);
    setRecentGroups(recentGroupsList);
    if (bootstrapCards.length > 0) {
      const firstActive = bootstrapCards.find(c => activeGroups.some(g => g.id === c.groupId)) ?? bootstrapCards[0];
      setCardInfo({
        lastFour: firstActive.cardLastFour ?? '0000',
        balance: firstActive.groupTotal ?? 0,
        groupId: firstActive.groupId,
      });
    } else {
      setCardInfo(null);
    }
    if (mapped.length > 0) {
      prefetchAllGroupDetails(mapped.map(g => g.id));
    }
    setInitialDataLoaded(true);
  }, [authLoading, user, bootstrapGroups, bootstrapCards]);

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

  const handleNavigate = (page: PageType, groupId?: string) => {
    setPageHistory(prev => [...prev, currentPage]);
    setCurrentPage(page);
    if (groupId !== undefined) {
      setSelectedGroupId(groupId);
      if (page === 'receiptScan') {
        setProcessingGroupId(groupId);
      }
    } else if (page === 'cardDetails' && cardInfo?.groupId) {
      setSelectedGroupId(cardInfo.groupId);
    }
  };

  /** Navigate to receipt items page with a specific receipt (for invited users or Edit) */
  const handleNavigateToReceiptItems = (gId: string, receiptId: string) => {
    setProcessingGroupId(gId);
    setLastReceiptId(receiptId);
    setSelectedGroupId(gId);
    setReceiptScanForEvenSplit(false);
    setPageHistory(prev => [...prev, currentPage]);
    setCurrentPage('receiptItems');
  };

  /** Navigate to receipt scan - for even split returns to group after upload */
  const handleNavigateToReceiptScan = (gId: string, forEvenSplit: boolean) => {
    setProcessingGroupId(gId);
    setSelectedGroupId(gId);
    setReceiptScanForEvenSplit(forEvenSplit);
    setLastReceiptId(null);
    setPageHistory(prev => [...prev, currentPage]);
    setCurrentPage('receiptScan');
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

  // When logged in and we have a pending invite token, navigate to accept page
  useEffect(() => {
    if (isAuthenticated && pendingInviteToken && !showSplash && currentPage === 'home') {
      setCurrentPage('acceptInvite');
    }
  }, [isAuthenticated, pendingInviteToken, currentPage, showSplash]);

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-slate-900' : 'bg-black'}`}>
      <div className={`mx-auto max-w-[430px] h-screen ${theme === 'dark' ? 'bg-slate-900' : 'bg-[#F2F2F7]'} relative overflow-hidden`}>
        {showSplash ? (
          <SplashScreen
            onComplete={() => setSplashAnimDone(true)}
            loadingMessage={(authLoading || !initialDataLoaded) && splashAnimDone ? 'Loading your account...' : undefined}
          />
        ) : showForgotPassword ? (
          <ForgotPasswordPage onNavigate={handleNavigate} onBack={() => setShowForgotPassword(false)} theme={theme} />
        ) : !isAuthenticated ? (
          <LoginSignup onAuthenticate={handlePostAuth} onForgotPassword={() => setShowForgotPassword(true)} />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              className="w-full min-h-full"
            >
              {currentPage === 'home' && (
                <LandingPage 
                  onNavigate={handleNavigate} theme={theme} groups={activeGroups} recentGroups={recentGroups}
                  unreadNotificationCount={unreadNotificationCount}
                  pendingInvites={pendingInvites} acceptInvite={acceptInvite} declineInvite={declineInvite}
                  preloadedCardInfo={cardInfo}
                />
              )}
              {currentPage === 'groups' && (
                <GroupsPage 
                  onNavigate={handleNavigate} theme={theme} groups={activeGroups}
                  recentGroups={recentGroups} accountType={accountType}
                  deleteGroup={deleteGroup} leaveGroup={leaveGroup} currentUserId={user?.id ?? ''}
                />
              )}
              {currentPage === 'activity' && <ActivityPage onNavigate={handleNavigate} theme={theme} />}
              {currentPage === 'account' && <AccountPage onNavigate={handleNavigate} theme={theme} />}
              {currentPage === 'settings' && <SettingsPage onNavigate={handleNavigate} theme={theme} onThemeChange={handleThemeChange} onLogout={handleLogout} />}
              {currentPage === 'wallet' && <VirtualWalletPage onNavigate={handleNavigate} theme={theme} />}
              {currentPage === 'cardDetails' && <CardDetailsPage onNavigate={handleNavigate} theme={theme} groupId={selectedGroupId ?? undefined} />}
              {currentPage === 'createGroup' && <CreateGroupPage onNavigate={handleNavigate} theme={theme} onGroupCreated={loadGroups} />}
              {currentPage === 'receiptScan' && <ReceiptScanPage onNavigate={handleNavigate} theme={theme} realGroupId={processingGroupId} onReceiptUploaded={(id) => setLastReceiptId(id)} returnToGroupAfterUpload={receiptScanForEvenSplit} onReturnToGroup={() => { setReceiptScanForEvenSplit(false); invalidateGroupCache(processingGroupId ?? ''); }} />}
              {currentPage === 'receiptItems' && <ReceiptItemsPage onNavigate={handleNavigate} theme={theme} setReceiptData={setReceiptData} setItemSplitData={setItemSplitData} receiptId={lastReceiptId} groupId={processingGroupId} onSelectionConfirmed={(gId) => invalidateGroupCache(gId)} />}
              {currentPage === 'processing' && <ProcessingPaymentPage onNavigate={handleNavigate} theme={theme} groupId={processingGroupId} accountType={accountType} transactionId={currentTransactionId} receiptData={receiptData} itemSplitData={itemSplitData} onSettlementComplete={() => { invalidateGroupCache(processingGroupId ?? ''); loadGroups(); }} />}
              {currentPage === 'groupDetail' && <GroupDetailPage onNavigate={handleNavigate} theme={theme} groupId={selectedGroupId} groups={[...activeGroups, ...recentGroups]} deleteGroup={deleteGroup} leaveGroup={leaveGroup} currentUserId={user?.id ?? ''} itemSplitData={itemSplitData} setItemSplitData={setItemSplitData} receiptData={receiptData} onStartProcessing={(txId) => { setCurrentTransactionId(txId); }} onGroupsChanged={loadGroups} onNavigateToReceiptItems={handleNavigateToReceiptItems} onNavigateToReceiptScan={handleNavigateToReceiptScan} />}
              {currentPage === 'notifications' && <NotificationsPage onNavigate={handleNavigate} theme={theme} notifications={notifications} setNotifications={setNotifications} unreadCount={unreadNotificationCount} acceptInvite={acceptInvite} declineInvite={declineInvite} />}
              {currentPage === 'notificationsSettings' && <NotificationsSettingsPage onNavigate={handleNavigate} theme={theme} />}
              {currentPage === 'privacySettings' && <PrivacySettingsPage onNavigate={handleNavigate} theme={theme} />}
              {currentPage === 'helpSupport' && <HelpSupportPage onNavigate={handleNavigate} theme={theme} />}
              {currentPage === 'appearanceSettings' && <AppearanceSettingsPage onNavigate={handleNavigate} theme={theme} onThemeChange={handleThemeChange} themePreference={themePreference} />}
              {currentPage === 'changePassword' && <ChangePasswordPage onNavigate={handleNavigate} theme={theme} />}
              {currentPage === 'twoFactorAuth' && <TwoFactorAuthPage onNavigate={handleNavigate} theme={theme} />}
              {currentPage === 'acceptInvite' && (
                <AcceptInvitePage
                  onNavigate={handleNavigate}
                  theme={theme}
                  inviteCode={pendingInviteToken ?? undefined}
                  onAccepted={() => { setPendingInviteToken(null); loadGroups(); }}
                />
              )}
              {currentPage === 'proAccount' && <ProAccountPage onNavigate={handleNavigate} theme={theme} currentPlan={accountType} onUpgrade={handleUpgradeToPro} />}
            </motion.div>
          </AnimatePresence>
        )}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-36 h-1 bg-black rounded-full opacity-40" />
      </div>
    </div>
  );
}
