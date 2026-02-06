import { useState } from 'react';
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

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [currentPage, setCurrentPage] = useState<PageType>('home');
  const [themePreference, setThemePreference] = useState<'light' | 'dark' | 'system'>('system');
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [pageHistory, setPageHistory] = useState<PageType[]>([]);
  
  // Track account type
  const [accountType, setAccountType] = useState<'standard' | 'pro'>('standard');
  
  // Track active receipt processing group
  const [processingGroupId, setProcessingGroupId] = useState<number | null>(null);
  
  // Track receipt data for payment processing
  const [receiptData, setReceiptData] = useState<{
    members: Array<{ id: number; name: string; amount: number; avatar: string }>;
    total: number;
  } | null>(null);
  
  // Track groups and memberships
  const [groups, setGroups] = useState([
    { id: 1, name: 'Lunch Squad', members: 4, balance: 45.80, color: '#3B82F6', createdBy: 1 }, // Blue
    { id: 2, name: 'Roommates', members: 3, balance: 120.00, color: '#A855F7', createdBy: 1 }, // Purple
    { id: 3, name: 'Road Trip 2026', members: 6, balance: 0, color: '#22C55E', createdBy: 2 }, // Green
    { id: 4, name: 'Office Lunch', members: 5, balance: 67.50, color: '#F97316', createdBy: 1 }, // Orange
  ]);

  // Track recent (deleted) groups
  const [recentGroups, setRecentGroups] = useState<Array<{ 
    id: number; 
    name: string; 
    members: number; 
    balance: number; 
    color: string; 
    createdBy: number;
    deletedAt: Date;
  }>>([]);
  
  const currentUserId = 1; // Mock current user ID

  // Track notifications
  const [notifications, setNotifications] = useState([
    { 
      id: 1, 
      type: 'invite', 
      title: 'Group Invitation', 
      message: 'Sarah Mitchell invited you to Weekend Brunch Club',
      time: '5m ago',
      read: false,
    },
    { 
      id: 2, 
      type: 'receipt', 
      title: 'New Receipt', 
      message: 'Mike added a receipt to Lunch Squad for $45.80',
      time: '2h ago',
      read: false,
    },
    { 
      id: 3, 
      type: 'payment', 
      title: 'Payment Processed', 
      message: 'Your payment of $15.50 to Lunch Squad was successful',
      time: '1d ago',
      read: true,
    },
    { 
      id: 4, 
      type: 'group', 
      title: 'Group Update', 
      message: 'Emma Davis joined Office Lunch',
      time: '2d ago',
      read: true,
    },
  ]);

  // Track pending invites
  const [pendingInvites, setPendingInvites] = useState([
    { id: 1, groupName: 'Weekend Brunch Club', inviterName: 'Sarah Mitchell', members: 5 },
    { id: 2, groupName: 'Gym Buddies', inviterName: 'Mike Johnson', members: 3 },
  ]);

  const acceptInvite = (inviteId: number) => {
    const invite = pendingInvites.find(inv => inv.id === inviteId);
    if (invite) {
      // Add the group to groups array
      const newGroup = {
        id: Math.max(...groups.map(g => g.id), 0) + 1,
        name: invite.groupName,
        members: invite.members,
        balance: 0,
        color: ['#3B82F6', '#A855F7', '#22C55E', '#F97316', '#EC4899'][Math.floor(Math.random() * 5)],
        createdBy: 2, // Not created by current user
      };
      setGroups([...groups, newGroup]);
      // Remove from pending invites
      setPendingInvites(pendingInvites.filter(inv => inv.id !== inviteId));
    }
  };

  const declineInvite = (inviteId: number) => {
    setPendingInvites(pendingInvites.filter(inv => inv.id !== inviteId));
  };

  const unreadNotificationCount = notifications.filter(n => !n.read).length;

  const deleteGroup = (groupId: number) => {
    const groupToDelete = groups.find(g => g.id === groupId);
    if (groupToDelete) {
      setRecentGroups(prev => [...prev, { ...groupToDelete, deletedAt: new Date() }]);
    }
    setGroups(prev => prev.filter(g => g.id !== groupId));
  };

  const leaveGroup = (groupId: number) => {
    setGroups(prev => prev.filter(g => g.id !== groupId));
  };

  const addGroup = (name: string, memberEmails: string[]) => {
    const newGroup = {
      id: Math.max(...groups.map(g => g.id), 0) + 1,
      name,
      members: memberEmails.length + 1, // +1 for the creator
      balance: 0,
      color: ['#3B82F6', '#A855F7', '#22C55E', '#F97316'][Math.floor(Math.random() * 4)],
      createdBy: currentUserId,
    };
    setGroups(prev => [...prev, newGroup]);
    return newGroup.id;
  };

  // Determine actual theme based on preference
  const theme = themePreference === 'system' 
    ? 'light' // In real app, this would check window.matchMedia('(prefers-color-scheme: dark)').matches
    : themePreference;

  const handleNavigate = (page: PageType, groupId?: number) => {
    setPageHistory(prev => [...prev, currentPage]);
    setCurrentPage(page);
    if (groupId !== undefined) {
      setSelectedGroupId(groupId);
      // If navigating to receipt scan, track which group is being processed
      if (page === 'receiptScan') {
        setProcessingGroupId(groupId);
      }
    }
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setThemePreference(newTheme);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentPage('home');
    setPageHistory([]);
    // Reset groups on logout
    setGroups([
      { id: 1, name: 'Lunch Squad', members: 4, balance: 45.80, color: '#3B82F6', createdBy: 1 },
      { id: 2, name: 'Roommates', members: 3, balance: 120.00, color: '#A855F7', createdBy: 1 },
      { id: 3, name: 'Road Trip 2026', members: 6, balance: 0, color: '#22C55E', createdBy: 2 },
      { id: 4, name: 'Office Lunch', members: 5, balance: 67.50, color: '#F97316', createdBy: 1 },
    ]);
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
        ) : showForgotPassword ? (
          <ForgotPasswordPage onNavigate={handleNavigate} onBack={() => setShowForgotPassword(false)} theme={theme} />
        ) : !isAuthenticated ? (
          <LoginSignup onAuthenticate={() => setIsAuthenticated(true)} onForgotPassword={() => setShowForgotPassword(true)} />
        ) : (
          <>
            {currentPage === 'home' && <LandingPage 
              onNavigate={handleNavigate} 
              theme={theme} 
              groups={groups} 
              unreadNotificationCount={unreadNotificationCount}
              pendingInvites={pendingInvites}
              acceptInvite={acceptInvite}
              declineInvite={declineInvite}
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
            {currentPage === 'acceptInvite' && <AcceptInvitePage onNavigate={handleNavigate} theme={theme} />}
            {currentPage === 'proAccount' && <ProAccountPage onNavigate={handleNavigate} theme={theme} currentPlan={accountType} onUpgrade={handleUpgradeToPro} />}
          </>
        )}

        {/* iOS Home Indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-36 h-1 bg-black rounded-full opacity-40" />
      </div>
    </div>
  );
}