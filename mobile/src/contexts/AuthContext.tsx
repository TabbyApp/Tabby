import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  api,
  BootstrapGroup,
  User,
  VirtualCard,
  clearAuthTokens,
  getAuthTokens,
  setAuthTokens,
} from '../lib/api';

const ACCESS_TOKEN_KEY = 'tabby_mobile_access_token';
const REFRESH_TOKEN_KEY = 'tabby_mobile_refresh_token';

type AuthContextValue = {
  user: User | null;
  groups: BootstrapGroup[];
  virtualCards: VirtualCard[];
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  loginWithPhone: (phone: string, code: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshBootstrap: () => Promise<void>;
  setUser: (updates: Partial<User>) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function persistTokens(accessToken: string | null, refreshToken: string | null) {
  if (accessToken) {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  } else {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  }

  if (refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  } else {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [groups, setGroups] = useState<BootstrapGroup[]>([]);
  const [virtualCards, setVirtualCards] = useState<VirtualCard[]>([]);
  const [loading, setLoading] = useState(true);

  const applyBootstrap = useCallback((data: Awaited<ReturnType<typeof api.bootstrap>>) => {
    setUserState(data.user);
    setGroups(data.groups);
    setVirtualCards(data.virtualCards);
  }, []);

  const refreshBootstrap = useCallback(async () => {
    const data = await api.bootstrap();
    applyBootstrap(data);
  }, [applyBootstrap]);

  useEffect(() => {
    let mounted = true;
    async function hydrate() {
      try {
        const [accessToken, refreshToken] = await Promise.all([
          SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
          SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
        ]);
        setAuthTokens({ accessToken, refreshToken });
        if (!accessToken && !refreshToken) {
          if (mounted) setLoading(false);
          return;
        }
        const data = await api.bootstrap({ noRefreshOn401: true });
        if (mounted) applyBootstrap(data);
      } catch {
        clearAuthTokens();
        await persistTokens(null, null);
        if (mounted) {
          setUserState(null);
          setGroups([]);
          setVirtualCards([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void hydrate();
    return () => {
      mounted = false;
    };
  }, [applyBootstrap]);

  const handleAuthSuccess = useCallback(
    async (payload: { accessToken: string; refreshToken: string }) => {
      setAuthTokens(payload);
      await persistTokens(payload.accessToken, payload.refreshToken);
      const data = await api.bootstrap();
      applyBootstrap(data);
    },
    [applyBootstrap],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await api.auth.login(email, password);
      await handleAuthSuccess(response);
    },
    [handleAuthSuccess],
  );

  const signup = useCallback(
    async (email: string, password: string) => {
      const response = await api.auth.signup(email, password);
      await handleAuthSuccess(response);
    },
    [handleAuthSuccess],
  );

  const loginWithPhone = useCallback(
    async (phone: string, code: string, name?: string) => {
      const response = await api.auth.verifyOtp(phone, code, name);
      await handleAuthSuccess(response);
    },
    [handleAuthSuccess],
  );

  const logout = useCallback(async () => {
    try {
      const { refreshToken } = getAuthTokens();
      if (refreshToken) {
        await api.auth.logout();
      }
    } catch {
      // Ignore logout failures when clearing local session.
    } finally {
      clearAuthTokens();
      await persistTokens(null, null);
      setUserState(null);
      setGroups([]);
      setVirtualCards([]);
    }
  }, []);

  const setUser = useCallback((updates: Partial<User>) => {
    setUserState((current) => (current ? { ...current, ...updates } : (updates as User)));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      groups,
      virtualCards,
      loading,
      login,
      signup,
      loginWithPhone,
      logout,
      refreshBootstrap,
      setUser,
    }),
    [groups, loading, login, loginWithPhone, logout, refreshBootstrap, setUser, signup, user, virtualCards],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
