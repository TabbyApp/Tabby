import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, setAccessToken, clearTokens } from '../lib/api';

export type PaymentMethod = { id: string; type: string; last_four: string; brand: string | null; created_at: string };
type User = {
  id: string; email: string; name: string;
  bank_linked?: boolean;
  phone?: string;
  avatarUrl?: string | null;
  paymentMethods?: PaymentMethod[];
} | null;

export type BootstrapGroup = { id: string; name: string; memberCount: number; cardLastFour: string | null; lastSettledAt?: string | null };
export type BootstrapVirtualCard = { groupId: string; groupName: string; cardLastFour: string | null; active: boolean; groupTotal: number };

type AuthContextValue = {
  user: User;
  groups: BootstrapGroup[];
  virtualCards: BootstrapVirtualCard[];
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  loginWithPhone: (phone: string, code: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
  refreshBootstrap: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User>(null);
  const [groups, setGroups] = useState<BootstrapGroup[]>([]);
  const [virtualCards, setVirtualCards] = useState<BootstrapVirtualCard[]>([]);
  const [loading, setLoading] = useState(true);

  const setUser = useCallback((u: User) => {
    setUserState(u);
  }, []);

  const applyBootstrap = useCallback((data: Awaited<ReturnType<typeof api.bootstrap>>) => {
    const pm = Array.isArray(data.user.paymentMethods) ? data.user.paymentMethods : [];
    setUserState({
      id: data.user.id,
      email: data.user.email,
      name: data.user.name,
      bank_linked: data.user.bank_linked,
      phone: data.user.phone ?? '',
      avatarUrl: (data.user as { avatarUrl?: string }).avatarUrl ?? null,
      paymentMethods: pm as PaymentMethod[],
    });
    setGroups(data.groups);
    setVirtualCards(data.virtualCards);
  }, []);

  const refreshBootstrap = useCallback(async () => {
    if (!user) return;
    const data = await api.bootstrap();
    applyBootstrap(data);
  }, [user, applyBootstrap]);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('tabby_access_token') : null;
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .bootstrap({ noRefreshOn401: true })
      .then(applyBootstrap)
      .catch((err) => {
        const msg = err instanceof Error ? err.message : '';
        const isAuthFailure = /401|unauthorized|invalid.*token|token.*expired/i.test(msg);
        if (isAuthFailure) {
          clearTokens();
        }
        setUserState(null);
        setGroups([]);
        setVirtualCards([]);
      })
      .finally(() => setLoading(false));
  }, [applyBootstrap]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const data = await api.auth.login(email, password);
      setAccessToken(data.accessToken);
      const boot = await api.bootstrap();
      applyBootstrap(boot);
    } catch (err) {
      throw err instanceof Error ? err : new Error('Login failed');
    }
  }, [applyBootstrap]);

  const signup = useCallback(async (email: string, password: string, name: string) => {
    try {
      const data = await api.auth.signup(email, password, name);
      setAccessToken(data.accessToken);
      const boot = await api.bootstrap();
      applyBootstrap(boot);
    } catch (err) {
      throw err instanceof Error ? err : new Error('Sign up failed');
    }
  }, [applyBootstrap]);

  const loginWithPhone = useCallback(async (phone: string, code: string, name?: string) => {
    try {
      const data = await api.auth.verifyOtp(phone, code, name);
      setAccessToken(data.accessToken);
      const boot = await api.bootstrap();
      applyBootstrap(boot);
    } catch (err) {
      throw err instanceof Error ? err : new Error('Sign in failed');
    }
  }, [applyBootstrap]);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      clearTokens();
      setUserState(null);
      setGroups([]);
      setVirtualCards([]);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, groups, virtualCards, loading, login, signup, loginWithPhone, logout, setUser, refreshBootstrap }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
