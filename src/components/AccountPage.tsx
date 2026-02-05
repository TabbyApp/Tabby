import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, User, Mail, CreditCard, Building2, Loader, Plus } from 'lucide-react';
import { usePlaidLink } from 'react-plaid-link';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { PageType } from '../App';

interface AccountPageProps {
  onNavigate: (page: PageType) => void;
  theme: 'light' | 'dark';
}

type PaymentMethod = { id: string; type: string; last_four: string; brand: string | null };

export function AccountPage({ onNavigate, theme }: AccountPageProps) {
  const isDark = theme === 'dark';
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState<{
    id: string;
    name: string;
    email: string;
    paymentMethods: PaymentMethod[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [plaidError, setPlaidError] = useState<string | null>(null);

  const loadProfile = useCallback(() => {
    setLoading(true);
    api.users
      .me()
      .then((data) => {
        setProfile({
          id: data.id,
          name: data.name,
          email: data.email,
          paymentMethods: (data.paymentMethods || []) as PaymentMethod[],
        });
      })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Reload when navigating back to this page (e.g., from Plaid flow)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadProfile();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadProfile]);

  const fetchLinkToken = useCallback(() => {
    setPlaidError(null);
    api.plaid
      .getLinkToken()
      .then((data) => setLinkToken(data.linkToken))
      .catch((err) => {
        setPlaidError(err instanceof Error ? err.message : 'Could not start bank link');
      });
  }, []);

  const onPlaidSuccess = useCallback(
    (publicToken: string) => {
      api.plaid
        .exchangePublicToken(publicToken)
        .then(() => {
          setLinkToken(null);
          setPlaidError(null);
          loadProfile();
          // Invalidate dashboard cache so home page shows updated payment methods
          import('../lib/api').then(({ invalidateDashboardCache }) => {
            invalidateDashboardCache();
          });
          // Navigate back to Home after successful bank linking
          // This ensures the invite widget re-surfaces with "Join group" button
          setTimeout(() => {
            onNavigate('home');
          }, 500);
        })
        .catch((err) => {
          setPlaidError(err instanceof Error ? err.message : 'Failed to add account');
        });
    },
    [loadProfile, onNavigate]
  );

  const { open: openPlaidLink, ready: plaidReady } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
    onExit: (err, metadata) => {
      setLinkToken(null);
      if (err) {
        setPlaidError(err.message || 'Plaid Link was closed');
      }
      // If user cancelled, clear any error
      if (metadata?.status === 'requires_verification' || metadata?.status === 'requires_credentials') {
        setPlaidError(null);
      }
    },
  });

  useEffect(() => {
    if (linkToken && plaidReady) {
      openPlaidLink();
    }
  }, [linkToken, plaidReady, openPlaidLink]);

  const handleAddBankAccount = () => {
    fetchLinkToken();
  };

  return (
    <div className={`h-[calc(100vh-48px-24px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-b px-5 py-4`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('home')}
            className={`w-9 h-9 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-100'} flex items-center justify-center active:scale-95 transition-transform`}
          >
            <ChevronLeft size={20} className={isDark ? 'text-white' : 'text-slate-800'} strokeWidth={2.5} />
          </button>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Account</h1>
        </div>
      </motion.div>

      <div className="flex-1 overflow-y-auto px-5 py-6">
        <>
        <motion.div
          initial={{ scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="flex flex-col items-center mb-8"
        >
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-slate-600 to-blue-500 flex items-center justify-center text-white shadow-lg mb-4">
            <User size={40} strokeWidth={2.5} />
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="space-y-3"
        >
          <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 shadow-sm`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full ${isDark ? 'bg-slate-700' : 'bg-blue-100'} flex items-center justify-center`}>
                <User size={20} className="text-blue-500" />
              </div>
              <div className="flex-1">
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Full Name</p>
                <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  {profile?.name ?? authUser?.name ?? '—'}
                </p>
              </div>
            </div>
          </div>

          <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 shadow-sm`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full ${isDark ? 'bg-slate-700' : 'bg-purple-100'} flex items-center justify-center`}>
                <Mail size={20} className="text-purple-500" />
              </div>
              <div className="flex-1">
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Email</p>
                <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  {profile?.email ?? authUser?.email ?? '—'}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.15, delay: 0.05 }}
          className="mt-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide`}>
              Payment Methods
            </h2>
            {profile?.paymentMethods && profile.paymentMethods.length > 0 && (
              <button
                onClick={handleAddBankAccount}
                disabled={!!linkToken}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 ${
                  linkToken
                    ? `${isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'} cursor-wait`
                    : isDark
                    ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                } transition-colors`}
              >
                {linkToken ? (
                  <>
                    <Loader size={14} className="animate-spin" />
                    Linking...
                  </>
                ) : (
                  <>
                    <Plus size={14} />
                    Add
                  </>
                )}
              </button>
            )}
          </div>
          {plaidError && (
            <div className={`mb-3 p-3 rounded-lg ${isDark ? 'bg-red-900/30 border border-red-800' : 'bg-red-50 border border-red-200'}`}>
              <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-600'}`}>{plaidError}</p>
            </div>
          )}
          {loading && !profile ? (
            <div className="flex items-center justify-center py-8">
              <Loader size={24} className="animate-spin text-blue-500" />
            </div>
          ) : profile?.paymentMethods && profile.paymentMethods.length > 0 ? (
            <div className="space-y-2">
              {profile.paymentMethods.map((pm) => (
                <div
                  key={pm.id}
                  className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 border ${isDark ? 'border-slate-700' : 'border-slate-200'} flex items-center gap-3`}
                >
                  <div className={`w-12 h-12 rounded-xl ${pm.type === 'bank' ? 'bg-gradient-to-br from-blue-500 to-blue-600' : 'bg-gradient-to-br from-purple-500 to-indigo-600'} flex items-center justify-center shadow-sm`}>
                    {pm.type === 'bank' ? (
                      <Building2 size={22} className="text-white" />
                    ) : (
                      <CreditCard size={22} className="text-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                      {pm.type === 'bank' ? 'Bank Account' : pm.brand ?? 'Card'}
                    </p>
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} font-mono`}>
                      •••• {pm.last_four}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`${isDark ? 'bg-gradient-to-br from-slate-800 to-slate-800/50' : 'bg-gradient-to-br from-white to-slate-50'} rounded-2xl p-8 border ${isDark ? 'border-slate-700' : 'border-slate-200'} text-center`}>
              <div className={`w-16 h-16 rounded-2xl ${isDark ? 'bg-slate-700' : 'bg-blue-100'} flex items-center justify-center mx-auto mb-4`}>
                <Building2 size={28} className={isDark ? 'text-slate-400' : 'text-blue-600'} />
              </div>
              <h3 className={`font-semibold text-lg mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                No payment methods
              </h3>
              <p className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Add a bank account to join groups and split bills
              </p>
              <button
                onClick={handleAddBankAccount}
                disabled={!!linkToken}
                className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                  linkToken
                    ? `${isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-300 text-slate-500'} cursor-wait`
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 active:scale-95 shadow-lg'
                }`}
              >
                {linkToken ? (
                  <>
                    <Loader size={18} className="animate-spin" />
                    Opening secure link...
                  </>
                ) : (
                  <>
                    <Building2 size={18} />
                    Add bank account
                  </>
                )}
              </button>
              <p className={`text-xs mt-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Sandbox: use <strong>user_good</strong> / <strong>pass_good</strong>
              </p>
            </div>
          )}
        </motion.div>
        </>
      </div>
    </div>
  );
}
