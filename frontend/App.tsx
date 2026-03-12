import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { AccountSetupPage } from './components/AccountSetupPage';
import { useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { api } from './lib/api';
import { prefetchAllGroupDetails, invalidateGroupCache } from './lib/groupCache';

export type PageType = 'home' | 'groups' | 'activity' | 'account' | 'settings' | 
  'wallet' | 'cardDetails' | 'createGroup' | 'receiptScan' | 'receiptItems' | 'processing' |
  'groupDetail' | 'notifications' | 'notificationsSettings' | 'privacySettings' | 'helpSupport' | 
  'appearanceSettings' | 'changePassword' | 'twoFactorAuth' | 'forgotPassword' | 'acceptInvite' | 'proAccount' | 'accountSetup';

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

interface AppNotification {
  id: string;
  type: 'invite' | 'receipt' | 'payment' | 'group';
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  groupId?: string;
  groupName?: string;
  inviterName?: string;
  inviteToken?: string;
  source?: 'server' | 'local';
}

type StoredInviteNotification = {
  token: string;
  groupName?: string;
  createdAt: string;
};

const GROUP_COLORS = ['#3B82F6', '#A855F7', '#22C55E', '#F97316', '#EC4899', '#14B8A6', '#F59E0B', '#6366F1'];
const LOCAL_INVITE_NOTIFICATIONS_KEY = 'tabby_local_invite_notifications';

function readStoredInviteNotifications(): StoredInviteNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_INVITE_NOTIFICATIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredInviteNotifications(items: StoredInviteNotification[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCAL_INVITE_NOTIFICATIONS_KEY, JSON.stringify(items));
}

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
  
  // Real groups from backend (single source of truth; active/recent derived below for list UIs and socket-driven updates)
  const [groups, setGroups] = useState<AppGroup[]>([]);

  const FIFTEEN_MIN_MS = 15 * 60 * 1000;
  const activeGroups = useMemo(() => {
    return groups.filter((g) => {
      const ls = g.lastSettledAt;
      if (!ls) return true;
      return Date.now() - new Date(ls).getTime() < FIFTEEN_MIN_MS;
    });
  }, [groups]);
  const recentGroups = useMemo(() => {
    return groups.filter((g) => {
      const ls = g.lastSettledAt;
      if (!ls) return false;
      return Date.now() - new Date(ls).getTime() >= FIFTEEN_MIN_MS;
    });
  }, [groups]);

  // Preloaded virtual card info for LandingPage
  const [cardInfo, setCardInfo] = useState<{ lastFour: string; balance: number; groupId?: string } | null>(null);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [pendingInviteToken, setPendingInviteToken] = useState<string | null>(null);
  const [accountNotice, setAccountNotice] = useState<string | null>(null);
  const [groupKickedReason, setGroupKickedReason] = useState<'removed' | 'deleted' | null>(null);

  const unreadNotificationCount = notifications.filter(n => !n.read).length;
  const pendingInvites = useMemo(() => {
    return notifications
      .filter((n) => n.type === 'invite')
      .map((n) => ({
        id: n.id,
        groupName: n.groupName ?? 'Group Invitation',
        inviterName: n.inviterName ?? 'Tabby',
        members: 0,
      }));
  }, [notifications]);

  // Parse /join/:token from URL on load (invite links). Persist so it survives login redirect/reload on deploy.
  const JOIN_TOKEN_KEY = 'tabby_join_token';
  const clearPendingInviteToken = useCallback(() => {
    setPendingInviteToken(null);
    try {
      sessionStorage.removeItem(JOIN_TOKEN_KEY);
    } catch {}
  }, []);

  const upsertLocalInviteNotification = useCallback(async (token: string) => {
    const existing = readStoredInviteNotifications();
    if (existing.some((item) => item.token === token)) return;

    let groupName: string | undefined;
    try {
      const preview = await api.groups.joinPreview(token);
      groupName = preview.groupName;
    } catch {
      groupName = undefined;
    }

    writeStoredInviteNotifications([
      { token, groupName, createdAt: new Date().toISOString() },
      ...existing,
    ]);
  }, []);

  const removeLocalInviteNotification = useCallback((token: string) => {
    const next = readStoredInviteNotifications().filter((item) => item.token !== token);
    writeStoredInviteNotifications(next);
  }, []);

  useEffect(() => {
    const m = window.location.pathname.match(/^\/join\/([a-f0-9]+)$/i);
    if (m?.[1]) {
      const token = m[1];
      setPendingInviteToken(token);
      void upsertLocalInviteNotification(token);
      try {
        sessionStorage.setItem(JOIN_TOKEN_KEY, token);
      } catch {}
      window.history.replaceState({}, '', '/');
    } else {
      const stored = sessionStorage.getItem(JOIN_TOKEN_KEY);
      if (stored) setPendingInviteToken(stored);
    }
  }, [upsertLocalInviteNotification]);

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

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }

    const [serverNotifications, localInviteNotifications] = await Promise.all([
      api.users.notifications().catch(() => [] as Array<{
        id: string;
        type: 'invite' | 'receipt' | 'payment' | 'group';
        title: string;
        message: string;
        createdAt: string;
        read?: boolean;
        groupId?: string;
        groupName?: string;
        inviterName?: string;
        inviteToken?: string;
        source?: 'server';
      }>),
      (async () => {
        const stored = readStoredInviteNotifications();
        const enriched = await Promise.all(
          stored.map(async (item) => {
            if (item.groupName) return item;
            try {
              const preview = await api.groups.joinPreview(item.token);
              return { ...item, groupName: preview.groupName };
            } catch {
              return item;
            }
          })
        );
        writeStoredInviteNotifications(enriched);
        return enriched;
      })(),
    ]);

    const next = [
      ...serverNotifications.map((n) => ({ ...n, source: 'server' as const })),
      ...localInviteNotifications.map((item) => ({
        id: `local-invite:${item.token}`,
        type: 'invite' as const,
        title: 'Group Invitation',
        message: `You were invited to join ${item.groupName ?? 'a group'}`,
        createdAt: item.createdAt,
        groupName: item.groupName,
        inviteToken: item.token,
        source: 'local' as const,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    setNotifications((prev) => {
      const readMap = new Map(prev.map((item) => [item.id, item.read]));
      return next.map((item) => ({
        ...item,
        read: readMap.get(item.id) ?? false,
      }));
    });
  }, [user]);

  // Use bootstrap data (user + groups + virtualCards). loadGroups (used by socket handlers) triggers refreshBootstrap → this effect runs → setGroups → activeGroups/recentGroups recompute.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setGroups([]);
      setCardInfo(null);
      setInitialDataLoaded(true);
      return;
    }
    const fifteenMinMs = 15 * 60 * 1000;
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
    const activeList = mapped.filter((g) => {
      const ls = g.lastSettledAt;
      if (!ls) return true;
      return Date.now() - new Date(ls).getTime() < fifteenMinMs;
    });
    if (bootstrapCards.length > 0) {
      const firstActive = bootstrapCards.find(c => activeList.some(g => g.id === c.groupId)) ?? bootstrapCards[0];
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

  useEffect(() => {
    if (authLoading) return;
    void loadNotifications();
  }, [authLoading, user, bootstrapGroups, loadNotifications]);

  const navigateToGroup = useCallback((groupId: string) => {
    setPageHistory((prev) => [...prev, currentPage]);
    setCurrentPage('groupDetail');
    const isSwitchingToDifferentGroup = selectedGroupId !== null && selectedGroupId !== groupId;
    setSelectedGroupId(groupId);
    if (isSwitchingToDifferentGroup) {
      setReceiptData(null);
      setItemSplitData({ hasSelectedItems: false, yourItemsTotal: 0 });
      setLastReceiptId(null);
      setProcessingGroupId(null);
      setCurrentTransactionId(null);
    }
  }, [currentPage, selectedGroupId]);

  const openAccountForBankLink = useCallback((message?: string) => {
    setAccountNotice(message ?? 'Link your bank account to join this group.');
    setPageHistory((prev) => [...prev, currentPage]);
    setCurrentPage('account');
  }, [currentPage]);

  const acceptInvite = useCallback(async (notificationId: string) => {
    const notification = notifications.find((item) => item.id === notificationId);
    if (!notification?.inviteToken) return;

    try {
      if (notification.source === 'local') {
        const result = await api.groups.joinByToken(notification.inviteToken);
        removeLocalInviteNotification(notification.inviteToken);
        if (pendingInviteToken === notification.inviteToken) clearPendingInviteToken();
        setNotifications((prev) => prev.filter((item) => item.id !== notificationId));
        await loadGroups();
        navigateToGroup(result.groupId);
        return;
      }

      const group = await api.invites.accept(notification.inviteToken);
      if (pendingInviteToken === notification.inviteToken) clearPendingInviteToken();
      setNotifications((prev) => prev.filter((item) => item.id !== notificationId));
      await loadGroups();
      navigateToGroup(group.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to accept invite';
      const code = err instanceof Error ? (err as Error & { code?: string }).code : undefined;
      if (code === 'PAYMENT_METHOD_REQUIRED') {
        openAccountForBankLink('You need to link a bank account before joining this group.');
        return;
      }
      window.alert(message);
    }
  }, [notifications, removeLocalInviteNotification, pendingInviteToken, clearPendingInviteToken, loadGroups, navigateToGroup, openAccountForBankLink]);

  const declineInvite = useCallback(async (notificationId: string) => {
    const notification = notifications.find((item) => item.id === notificationId);
    if (!notification?.inviteToken) return;

    try {
      if (notification.source === 'local') {
        removeLocalInviteNotification(notification.inviteToken);
      } else {
        await api.invites.decline(notification.inviteToken);
      }

      if (pendingInviteToken === notification.inviteToken) clearPendingInviteToken();
      setNotifications((prev) => prev.filter((item) => item.id !== notificationId));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to decline invite');
    }
  }, [notifications, removeLocalInviteNotification, pendingInviteToken, clearPendingInviteToken]);

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

  const [resolvedDark, setResolvedDark] = useState(false);
  useEffect(() => {
    if (themePreference === 'dark') {
      setResolvedDark(true);
    } else if (themePreference === 'light') {
      setResolvedDark(false);
    } else {
      setResolvedDark(typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
  }, [themePreference]);
  useEffect(() => {
    if (resolvedDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [resolvedDark]);
  const theme = resolvedDark ? 'dark' : 'light';

  const handleRemovedFromGroup = useCallback((groupId: string) => {
    loadGroups();
    setCurrentPage('home');
    setSelectedGroupId(null);
    setGroupKickedReason('removed');
  }, [loadGroups]);

  const handleGroupDeleted = useCallback((groupId: string) => {
    loadGroups();
    setCurrentPage('home');
    setSelectedGroupId(null);
    invalidateGroupCache(groupId);
    setGroupKickedReason('deleted');
  }, [loadGroups]);

  const handleNavigate = (page: PageType, groupId?: string) => {
    if (page !== 'account') {
      setAccountNotice(null);
    }
    setPageHistory(prev => [...prev, currentPage]);
    setCurrentPage(page);
    if (groupId !== undefined) {
      const isSwitchingToDifferentGroup = page === 'groupDetail' && selectedGroupId !== null && selectedGroupId !== groupId;
      setSelectedGroupId(groupId);
      if (page === 'receiptScan') {
        setProcessingGroupId(groupId);
      }
      // Clear receipt-related state only when opening a *different* group (so returning from item selection keeps summary)
      if (page === 'groupDetail' && isSwitchingToDifferentGroup) {
        setReceiptData(null);
        setItemSplitData({ hasSelectedItems: false, yourItemsTotal: 0 });
        setLastReceiptId(null);
        setProcessingGroupId(null);
        setCurrentTransactionId(null);
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
    clearPendingInviteToken();
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
  const localOnboardingCompleted =
    !!user?.id &&
    typeof window !== 'undefined' &&
    window.localStorage.getItem(`tabby_onboarding_completed:${user.id}`) === 'true';
  const needsAccountSetup = isAuthenticated && !(user?.onboardingCompleted || localOnboardingCompleted);

  // Keep splash visible until: (1) animation is done AND (2) auth resolved AND (3) initial data loaded
  const showSplash = !splashAnimDone || authLoading || !initialDataLoaded;

  // First-time users complete account setup before entering the app or accepting invites.
  useEffect(() => {
    if (!showSplash && needsAccountSetup && currentPage !== 'accountSetup') {
      setCurrentPage('accountSetup');
    }
  }, [showSplash, needsAccountSetup, currentPage]);

  // When logged in and we have a pending invite token, navigate to accept page after setup
  useEffect(() => {
    if (isAuthenticated && !needsAccountSetup && pendingInviteToken && !showSplash && currentPage === 'home') {
      setCurrentPage('acceptInvite');
    }
  }, [isAuthenticated, pendingInviteToken, currentPage, showSplash, needsAccountSetup]);

  return (
    <div className="h-[100dvh] min-h-[100dvh] bg-background overflow-hidden">
      <div className="mx-auto max-w-[430px] h-full bg-background relative overflow-hidden pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
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
          <SocketProvider
            enabled={!!user}
            onGroupsChanged={() => {
              void loadGroups();
              void loadNotifications();
            }}
            onGroupUpdated={(groupId) => {
              invalidateGroupCache(groupId);
              void loadNotifications();
            }}
            onActivityChanged={() => { void loadNotifications(); }}
            onRemovedFromGroup={handleRemovedFromGroup}
            onGroupDeleted={handleGroupDeleted}
          >
          <div className="relative h-full min-h-0">
          <AnimatePresence initial={false} mode="sync">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
              className="absolute inset-0 w-full h-full"
              style={{ willChange: 'opacity', backfaceVisibility: 'hidden', transform: 'translateZ(0)' }}
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
              {currentPage === 'account' && <AccountPage onNavigate={handleNavigate} theme={theme} notice={accountNotice} />}
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
                  onRequireBankLink={() => openAccountForBankLink('You need to link a bank account before joining this group.')}
                  onAccepted={async () => {
                    if (pendingInviteToken) removeLocalInviteNotification(pendingInviteToken);
                    clearPendingInviteToken();
                    await loadGroups();
                    await loadNotifications();
                  }}
                  onDeclined={async () => {
                    if (pendingInviteToken) removeLocalInviteNotification(pendingInviteToken);
                    clearPendingInviteToken();
                    await loadNotifications();
                  }}
                  onIgnored={() => {
                    clearPendingInviteToken();
                  }}
                />
              )}
              {currentPage === 'proAccount' && <ProAccountPage onNavigate={handleNavigate} theme={theme} currentPlan={accountType} onUpgrade={handleUpgradeToPro} />}
              {currentPage === 'accountSetup' && (
                <AccountSetupPage
                  theme={theme}
                  onComplete={() => setCurrentPage(pendingInviteToken ? 'acceptInvite' : 'home')}
                />
              )}
            </motion.div>
          </AnimatePresence>
          </div>
          </SocketProvider>
        )}
        {/* Modal: removed from group / group deleted */}
        {isAuthenticated && groupKickedReason && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-5 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-xl"
            >
              <p className="text-center text-lg font-semibold text-foreground">
                {groupKickedReason === 'removed'
                  ? "You've been removed from the group."
                  : 'This group was deleted.'}
              </p>
              <p className="text-center text-sm mt-2 text-muted-foreground">
                You've been taken back to home.
              </p>
              <button
                onClick={() => setGroupKickedReason(null)}
                className="w-full mt-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground"
              >
                OK
              </button>
            </motion.div>
          </div>
        )}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-36 h-1 bg-foreground/40 rounded-full" />
      </div>
    </div>
  );
}
