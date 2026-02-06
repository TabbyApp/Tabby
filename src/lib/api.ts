const API_BASE = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'tabby_access_token';

const DASHBOARD_CACHE_TTL_MS = 25_000; // 25s – instant when navigating back to home
type DashboardData = {
  groups: { id: string; name: string; memberCount: number; cardLastFour: string | null; createdAt?: string; createdBy?: string }[];
  virtualCards: { groupId: string; groupName: string; cardLastFour: string | null; active: boolean; groupTotal: number }[];
  pendingInvites: { inviteId: string; token: string; groupName: string; inviterName: string; createdAt: string }[];
};
let dashboardCache: { data: DashboardData; ts: number } | null = null;

export function invalidateDashboardCache() {
  dashboardCache = null;
}

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

let accessToken: string | null = getStoredToken();

export function setAccessToken(token: string) {
  accessToken = token;
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function getAccessToken() {
  return accessToken ?? getStoredToken();
}

export function clearTokens() {
  accessToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function refreshAccessToken(): Promise<boolean> {
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) return false;
  const data = await res.json();
  setAccessToken(data.accessToken);
  return true;
}

async function request<T>(
  path: string,
  options: RequestInit & { skipAuth?: boolean } = {}
): Promise<T> {
  const { skipAuth, ...opts } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string>),
  };

  const token = skipAuth ? null : (accessToken ?? getStoredToken());
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...opts,
      headers,
      credentials: 'include',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    if (msg.includes('fetch') || msg.includes('Failed') || msg.includes('Network')) {
      throw new Error('Cannot reach server. Make sure the backend is running (cd server && npm run dev).');
    }
    throw err;
  }

  if (res.status === 401 && !skipAuth && token) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      try {
        res = await fetch(`${API_BASE}${path}`, { ...opts, headers, credentials: 'include' });
      } catch (err) {
        throw new Error('Cannot reach server. Make sure the backend is running (cd server && npm run dev).');
      }
    }
  }

  const text = await res.text();
  let data: T;
  try {
    data = text ? JSON.parse(text) : ({} as T);
  } catch {
    throw new Error(text || res.statusText || 'Invalid response');
  }

  if (!res.ok) {
    const errMsg = (data as { error?: string })?.error || `Request failed: ${res.status}`;
    const err = new Error(errMsg) as Error & { code?: string };
    const code = (data as { code?: string })?.code;
    if (code) err.code = code;
    throw err;
  }

  return data;
}

export const api = {
  auth: {
    signup: (email: string, password: string, name: string) =>
      request<{ accessToken: string; user: { id: string; email: string; name: string; phone?: string } }>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
        skipAuth: true,
      }),
    login: (email: string, password: string) =>
      request<{ accessToken: string; user: { id: string; email: string; name: string; phone?: string } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        skipAuth: true,
      }),
    sendOtp: (phone: string) =>
      request<{ ok: boolean; message: string; code?: string }>('/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ phone }),
        skipAuth: true,
      }),
    verifyOtp: (phone: string, code: string, name?: string) =>
      request<{ accessToken: string; user: { id: string; email: string; name: string; phone?: string } }>('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone, code, name }),
        skipAuth: true,
      }),
    logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  },
  users: {
    me: () => request<{ id: string; email: string; name: string; paymentMethods: unknown[] }>('/users/me'),
    /** Single request for home: groups + cards + invites. Cached for instant back-navigation. */
    dashboard: (opts?: { revalidate?: boolean }): Promise<DashboardData> => {
      const useCache = dashboardCache && (Date.now() - dashboardCache.ts < DASHBOARD_CACHE_TTL_MS) && !opts?.revalidate;
      if (useCache) {
        const stale = Date.now() - dashboardCache!.ts > 5000;
        if (stale) {
          request<DashboardData>('/users/me/dashboard').then((data) => {
            dashboardCache = { data, ts: Date.now() };
          }).catch(() => {});
        }
        return Promise.resolve(dashboardCache!.data);
      }
      return request<DashboardData>('/users/me/dashboard').then((data) => {
        dashboardCache = { data, ts: Date.now() };
        return data;
      });
    },
    myPendingInvites: () =>
      request<{ inviteId: string; token: string; groupName: string; inviterName: string; createdAt: string }[]>(
        '/users/me/invites'
      ),
    addPaymentMethod: (type: 'bank' | 'card', lastFour: string, brand?: string) =>
      request<{ id: string; type: string; last_four: string; brand: string | null }>(
        '/users/payment-methods',
        { method: 'POST', body: JSON.stringify({ type, lastFour, brand }) }
      ),
  },
  plaid: {
    getLinkToken: () =>
      request<{ linkToken: string }>('/plaid/link-token', { method: 'POST' }),
    exchangePublicToken: (publicToken: string) =>
      request<{ ok: boolean; paymentMethods: { id: string; type: string; last_four: string; brand: string | null }[] }>(
        '/plaid/exchange',
        { method: 'POST', body: JSON.stringify({ public_token: publicToken }) }
      ),
  },
  invites: {
    getByToken: (token: string) =>
      request<{ inviteId: string; groupId: string; groupName: string; inviterName: string; inviteeEmail: string; token: string; createdAt: string }>(
        `/invites/${encodeURIComponent(token)}`,
        { skipAuth: true }
      ),
    accept: (token: string) =>
      request<{ id: string; name: string; members: { id: string; name: string; email: string }[]; cardLastFour: string | null }>(
        `/invites/${encodeURIComponent(token)}/accept`,
        { method: 'POST' }
      ).then((r) => {
        invalidateDashboardCache();
        return r;
      }),
    decline: (token: string) =>
      request<void>(`/invites/${encodeURIComponent(token)}`, { method: 'DELETE' }).then((r) => {
        invalidateDashboardCache();
        return r;
      }),
  },
  groups: {
    list: () => {
      if (dashboardCache && Date.now() - dashboardCache.ts < DASHBOARD_CACHE_TTL_MS) {
        return Promise.resolve(dashboardCache.data.groups);
      }
      return request<{ id: string; name: string; memberCount: number; cardLastFour: string | null }[]>('/groups');
    },
    create: (name: string, memberPhones?: string[]) =>
      request<{ id: string; name: string; memberCount: number; cardLastFour: string; members: { phone: string; status: 'joined' | 'invited' }[] }>('/groups', {
        method: 'POST',
        body: JSON.stringify({ name, memberPhones: memberPhones ?? [] }),
      }).then((r) => {
        invalidateDashboardCache();
        return r;
      }),
    resendPhoneInvite: (groupId: string, inviteId: string) =>
      request<{ ok: boolean; message: string }>(`/groups/${groupId}/phone-invites/${inviteId}/resend`, {
        method: 'POST',
      }),
    removePhoneInvite: (groupId: string, inviteId: string) =>
      request<void>(`/groups/${groupId}/phone-invites/${inviteId}`, {
        method: 'DELETE',
      }),
    get: (groupId: string) =>
      request<{ id: string; name: string; created_by: string; members: { id: string; name: string; email: string; phone: string | null; status: 'joined' }[]; pendingInvites: { id: string; phone: string; token: string; createdAt: string; status: 'invited' }[]; cardLastFour: string | null }>(
        `/groups/${groupId}`
      ),
    createInvite: (groupId: string, inviteeEmail?: string) =>
      request<{ inviteId: string; token: string; inviteLink: string }>(`/groups/${groupId}/invites`, {
        method: 'POST',
        body: JSON.stringify(inviteeEmail ? { inviteeEmail: inviteeEmail.trim().toLowerCase() } : {}),
      }),
    delete: (groupId: string) =>
      request<void>(`/groups/${groupId}`, { method: 'DELETE' }).then((r) => {
        invalidateDashboardCache();
        return r;
      }),
    removeMember: (groupId: string, userId: string) =>
      request<void>(`/groups/${groupId}/members/${userId}`, { method: 'DELETE' }).then((r) => {
        invalidateDashboardCache();
        return r;
      }),
    leave: (groupId: string) =>
      request<void>(`/groups/${groupId}/leave`, { method: 'POST' }).then((r) => {
        invalidateDashboardCache();
        return r;
      }),
    virtualCards: () =>
      request<{ groupId: string; groupName: string; cardLastFour: string | null; active: boolean; groupTotal: number }[]>(
        '/groups/virtual-cards/list'
      ),
  },
  receipts: {
    list: (groupId: string) =>
      request<
        {
          id: string;
          group_id: string;
          status: string;
          total: number | null;
          created_at: string;
          splits: { user_id: string; amount: number; status: string; name: string }[];
        }[]
      >(`/receipts?groupId=${encodeURIComponent(groupId)}`),
    upload: (groupId: string, file: File | Blob, total?: number) => {
      const formData = new FormData();
      formData.append('groupId', groupId);
      if (total != null) formData.append('total', String(total));
      formData.append('file', file);
      const token = getAccessToken();
      return fetch(`${API_BASE}/receipts/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
        body: formData,
      })
        .then(async (r) => {
          if (!r.ok) {
            const err = await r.json().catch(() => ({}));
            throw new Error((err as { error?: string }).error || `Upload failed (${r.status})`);
          }
          return r.json();
        })
        .catch((err) => {
          if (err instanceof Error) {
            const msg = err.message || '';
            if (/failed to fetch|network|econnrefused/i.test(msg)) {
              throw new Error('Cannot reach server. Make sure the backend is running (cd server && npm run dev).');
            }
            throw err;
          }
          throw new Error(String(err));
        });
    },
    get: (receiptId: string) =>
      request<{
        id: string;
        group_id: string;
        items: { id: string; name: string; price: number }[];
        claims: Record<string, string[]>;
        members: { id: string; name: string; email: string }[];
      }>(`/receipts/${receiptId}`),
    addItem: (receiptId: string, name: string, price: number) =>
      request<{ id: string; name: string; price: number }>(`/receipts/${receiptId}/items`, {
        method: 'POST',
        body: JSON.stringify({ name, price }),
      }),
    updateClaims: (receiptId: string, itemId: string, userIds: string[]) =>
      request<{ userIds: string[] }>(`/receipts/${receiptId}/items/${itemId}/claims`, {
        method: 'PUT',
        body: JSON.stringify({ userIds }),
      }),
    complete: (receiptId: string) =>
      request<{ ok: boolean; splits: { user_id: string; amount: number; name: string }[] }>(`/receipts/${receiptId}/complete`, { method: 'POST' }),
    mySplits: () =>
      request<{ id: string; receipt_id: string; amount: number; status: string; created_at: string; group_id: string; group_name: string }[]>(
        '/receipts/splits/me'
      ),
  },
};
