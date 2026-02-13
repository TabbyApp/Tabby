import React, { useState, useEffect, useMemo } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SplashScreen } from './components/SplashScreen';
import { LoginSignup } from './components/LoginSignup';
import { LandingPage } from './components/LandingPage';
import { GroupsPage } from './components/GroupsPage';
import { GroupDetailPage } from './components/GroupDetailPage';
import { ActivityPage } from './components/ActivityPage';
import { CreateExpensePage } from './components/CreateExpensePage';
import { AccountPage } from './components/AccountPage';
import { SettingsPage } from './components/SettingsPage';
import { VirtualWalletPage } from './components/VirtualWalletPage';
import { CardDetailsPage } from './components/CardDetailsPage';
import { CreateGroupPage } from './components/CreateGroupPage';
import { ReceiptScanPage } from './components/ReceiptScanPage';
import { ReceiptItemsPage } from './components/ReceiptItemsPage';
import { ProcessingPaymentPage } from './components/ProcessingPaymentPage';
import { LinkBankPage } from './components/LinkBankPage';
import { TransactionAllocationPage } from './components/TransactionAllocationPage';
import { useAuth } from './contexts/AuthContext';

export type PageType = 'home' | 'groups' | 'groupDetail' | 'activity' | 'create' | 'account' | 'settings' |
  'wallet' | 'cardDetails' | 'createGroup' | 'linkBank' | 'receiptScan' | 'receiptItems' | 'processing' | 'transactionAllocation';

export type PageState = {
  page: PageType;
  groupId?: string;
  transactionId?: string;
  receiptId?: string;
  splits?: { user_id: string; amount: number; name: string }[];
};

// Pages that stay mounted for instant tab switching
const PERSISTENT_TABS = new Set<PageType>(['home', 'groups', 'activity']);

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const [pageState, setPageState] = useState<PageState>({ page: 'home' });
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  // Track which persistent tabs have been visited so we mount them lazily
  const [visitedTabs, setVisitedTabs] = useState<Set<PageType>>(new Set(['home']));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let inviteToken = params.get('invite');
    if (inviteToken) {
      sessionStorage.setItem('tabby_invite', inviteToken);
      window.history.replaceState({}, '', window.location.pathname || '/');
    } else {
      inviteToken = sessionStorage.getItem('tabby_invite');
    }
    if (inviteToken && user?.bank_linked) {
      sessionStorage.removeItem('tabby_invite');
      import('./lib/api').then(({ api }) => {
        api.groups.joinByToken(inviteToken!)
          .then(({ groupId }) => {
            setPageState({ page: 'groupDetail', groupId });
          })
          .catch(() => {});
      });
    }
  }, [user?.bank_linked]);

  const setCurrentPage = (pageOrState: PageType | PageState) => {
    const next = typeof pageOrState === 'object' ? pageOrState : { page: pageOrState };
    setPageState(next);
    // Mark persistent tabs as visited so they mount
    if (PERSISTENT_TABS.has(next.page)) {
      setVisitedTabs((prev) => {
        if (prev.has(next.page)) return prev;
        const n = new Set(prev);
        n.add(next.page);
        return n;
      });
    }
  };

  const currentPage = pageState.page;

  return (
    <ErrorBoundary>
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
        ) : !isAuthenticated ? (
          <LoginSignup onAuthenticate={() => {}} />
        ) : !user?.bank_linked ? (
          <LinkBankPage onNavigate={setCurrentPage} theme={theme} />
        ) : (
          <>
            {/* Persistent tabs: mount once, show/hide with CSS for instant switching */}
            {visitedTabs.has('home') && (
              <div style={{ display: currentPage === 'home' ? 'contents' : 'none' }}>
                <LandingPage onNavigate={setCurrentPage} theme={theme} />
              </div>
            )}
            {visitedTabs.has('groups') && (
              <div style={{ display: currentPage === 'groups' ? 'contents' : 'none' }}>
                <GroupsPage onNavigate={setCurrentPage} theme={theme} />
              </div>
            )}
            {visitedTabs.has('activity') && (
              <div style={{ display: currentPage === 'activity' ? 'contents' : 'none' }}>
                <ActivityPage onNavigate={setCurrentPage} theme={theme} />
              </div>
            )}

            {/* Non-persistent pages: mount/unmount as before */}
            {currentPage === 'groupDetail' && pageState.groupId && (
              <GroupDetailPage groupId={pageState.groupId} onNavigate={setCurrentPage} theme={theme} />
            )}
            {currentPage === 'create' && <CreateExpensePage onNavigate={setCurrentPage} theme={theme} />}
            {currentPage === 'account' && <AccountPage onNavigate={setCurrentPage} theme={theme} />}
            {currentPage === 'settings' && <SettingsPage onNavigate={setCurrentPage} theme={theme} onThemeChange={setTheme} />}
            {currentPage === 'wallet' && <VirtualWalletPage onNavigate={setCurrentPage} theme={theme} />}
            {currentPage === 'cardDetails' && <CardDetailsPage onNavigate={setCurrentPage} theme={theme} />}
            {currentPage === 'createGroup' && <CreateGroupPage onNavigate={setCurrentPage} theme={theme} />}
            {currentPage === 'receiptScan' && (
              <ReceiptScanPage groupId={pageState.groupId} transactionId={pageState.transactionId} onNavigate={setCurrentPage} theme={theme} />
            )}
            {currentPage === 'receiptItems' && pageState.receiptId && pageState.groupId && (
              <ReceiptItemsPage receiptId={pageState.receiptId} groupId={pageState.groupId} onNavigate={setCurrentPage} theme={theme} />
            )}
            {currentPage === 'transactionAllocation' && pageState.transactionId && pageState.groupId && (
              <TransactionAllocationPage transactionId={pageState.transactionId} groupId={pageState.groupId} onNavigate={setCurrentPage} theme={theme} />
            )}
            {currentPage === 'processing' && (
              <ProcessingPaymentPage groupId={pageState.groupId} transactionId={pageState.transactionId} splits={pageState.splits ?? []} currentUserId={user?.id} onNavigate={setCurrentPage} theme={theme} />
            )}
          </>
        )}

        {/* iOS Home Indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-36 h-1 bg-black rounded-full opacity-40" />
      </div>
    </div>
    </ErrorBoundary>
  );
}
