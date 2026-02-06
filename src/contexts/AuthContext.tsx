import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, setAccessToken, clearTokens } from '../lib/api';

type User = { id: string; email: string; name: string; phone?: string } | null;

type AuthContextValue = {
  user: User;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  loginWithPhone: (phone: string, code: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  const setUser = useCallback((u: User) => {
    setUserState(u);
  }, []);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('tabby_access_token') : null;
    if (!token) {
      setLoading(false);
      return;
    }
    api.users
      .me()
      .then((data) => {
        setUserState({
          id: data.id,
          email: data.email,
          name: data.name,
          phone: (data as { phone?: string }).phone,
        });
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : '';
        // Only clear tokens on actual auth failure (401), never on network/500/server errors
        const isAuthFailure = /401|unauthorized|invalid.*token|token.*expired/i.test(msg);
        if (isAuthFailure) {
          clearTokens();
        }
        setUserState(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const data = await api.auth.login(email, password);
      setAccessToken(data.accessToken);
      setUserState(data.user);
    } catch (err) {
      throw err instanceof Error ? err : new Error('Login failed');
    }
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string) => {
    try {
      const data = await api.auth.signup(email, password, name);
      setAccessToken(data.accessToken);
      setUserState(data.user);
    } catch (err) {
      throw err instanceof Error ? err : new Error('Sign up failed');
    }
  }, []);

  const loginWithPhone = useCallback(async (phone: string, code: string, name?: string) => {
    try {
      const data = await api.auth.verifyOtp(phone, code, name);
      setAccessToken(data.accessToken);
      setUserState(data.user);
    } catch (err) {
      throw err instanceof Error ? err : new Error('Sign in failed');
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      clearTokens();
      setUserState(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, loginWithPhone, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
