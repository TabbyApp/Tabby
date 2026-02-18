const API_BASE = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'tabby_access_token';

/** Structured receipt shape (parsed or final snapshot). */
export interface ParsedReceipt {
  merchantName?: string;
  receiptDate?: string | null;
  totals: { subtotal?: number; tax?: number; tip?: number; total?: number };
  lineItems: { name: string; price: number; qty?: number; unitPrice?: number }[];
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
    throw new Error(errMsg);
  }

  return data;
}

export const api = {
  /** Single call for initial load: user + groups + virtualCards. Use after login or on app init. */
  bootstrap: () =>
    request<{
      user: { id: string; email: string; name: string; phone?: string; bank_linked: boolean; paymentMethods: unknown[] };
      groups: { id: string; name: string; memberCount: number; cardLastFour: string | null }[];
      virtualCards: { groupId: string; groupName: string; cardLastFour: string | null; active: boolean; groupTotal: number }[];
    }>('/bootstrap'),
  auth: {
    signup: (email: string, password: string, name: string) =>
      request<{ accessToken: string; user: { id: string; email: string; name: string } }>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
        skipAuth: true,
      }),
    login: (email: string, password: string) =>
      request<{ accessToken: string; user: { id: string; email: string; name: string } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        skipAuth: true,
      }),
    logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
    verifyOtp: (phone: string, code: string, name?: string) =>
      request<{ accessToken: string; user: { id: string; email: string; name: string; phone?: string } }>('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone, code, name }),
        skipAuth: true,
      }),
  },
  users: {
    me: () => request<{ id: string; email: string; name: string; phone?: string; bank_linked: boolean; paymentMethods: unknown[] }>('/users/me'),
    updateProfile: (data: { name?: string; email?: string; phone?: string }) =>
      request<{ id: string; email: string; name: string; phone: string }>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    linkBank: () => request<{ ok: boolean; bank_linked: boolean }>('/users/link-bank', { method: 'POST' }),
    addPaymentMethod: (type: 'bank' | 'card', lastFour: string, brand?: string) =>
      request<{ id: string; type: string; last_four: string; brand: string | null }>(
        '/users/payment-methods',
        { method: 'POST', body: JSON.stringify({ type, lastFour, brand }) }
      ),
  },
  groups: {
    list: () =>
      request<{ id: string; name: string; memberCount: number; cardLastFour: string | null }[]>('/groups'),
    create: (name: string, memberEmails?: string[]) =>
      request<{ id: string; name: string; memberCount: number; cardLastFour: string }>('/groups', {
        method: 'POST',
        body: JSON.stringify({ name, memberEmails }),
      }),
    get: (groupId: string) =>
      request<{ id: string; name: string; created_by: string; members: { id: string; name: string; email: string }[]; cardLastFour: string | null; inviteToken: string | null }>(
        `/groups/${groupId}`
      ),
    /** Batch fetch group details - 1 request instead of N (avoids connection queueing) */
    getBatch: (groupIds: string[]) =>
      request<Record<string, {
        id: string; name: string; created_by: string;
        members: { id: string; name: string; email: string }[];
        cardLastFour: string | null; inviteToken: string;
        receipts: { id: string; group_id: string; status: string; total: number | null; created_at: string; splits?: unknown[] }[];
      }>>(
        `/groups/batch?ids=${encodeURIComponent(groupIds.join(','))}`
      ),
    joinByToken: (token: string) =>
      request<{ groupId: string; groupName: string; joined: boolean }>(`/groups/join/${token}`, { method: 'POST' }),
    deleteGroup: (groupId: string) =>
      request<{ ok: boolean }>(`/groups/${groupId}`, { method: 'DELETE' }),
    leaveGroup: (groupId: string) =>
      request<{ ok: boolean }>(`/groups/${groupId}/leave`, { method: 'POST' }),
    removeMember: (groupId: string, memberId: string) =>
      request<{ ok: boolean }>(`/groups/${groupId}/members/${memberId}`, { method: 'DELETE' }),
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
    uploadWithProgress: (
      groupId: string,
      file: File | Blob,
      onProgress: (percent: number, phase: 'upload' | 'processing') => void
    ): Promise<{ id: string; status: string; parsed_output?: ParsedReceipt; confidence_map?: unknown; validation?: { isValid: boolean; issues: string[]; suggestedFieldsToReview: string[] } }> => {
      return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('groupId', groupId);
        formData.append('file', file);
        const token = getAccessToken();
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            onProgress(Math.round((e.loaded / e.total) * 90), 'upload');
          } else {
            onProgress(45, 'upload');
          }
        });

        xhr.addEventListener('load', () => {
          onProgress(100, 'processing');
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch {
              reject(new Error('Invalid response'));
            }
          } else {
            try {
              const err = JSON.parse(xhr.responseText || '{}');
              reject(new Error((err as { error?: string }).error || `Upload failed (${xhr.status})`));
            } catch {
              reject(new Error(`Upload failed (${xhr.status})`));
            }
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Cannot reach server. Make sure the backend is running (cd server && npm run dev).'));
        });

        xhr.open('POST', `${API_BASE}/receipts/upload`);
        xhr.withCredentials = true;
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
      });
    },
    get: (receiptId: string) =>
      request<{
        id: string;
        group_id: string;
        status: string;
        items: { id: string; name: string; price: number }[];
        claims: Record<string, string[]>;
        members: { id: string; name: string; email: string }[];
        parsed_output?: ParsedReceipt;
        confidence_map?: Record<string, number | number[]>;
        validation?: { isValid: boolean; issues: string[]; suggestedFieldsToReview: string[] };
        final_snapshot?: ParsedReceipt;
        file_path?: string;
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
    confirm: (receiptId: string, payload: ParsedReceipt) =>
      request<{ ok: boolean; receipt: { id: string; status: string; final_snapshot: ParsedReceipt } }>(`/receipts/${receiptId}/confirm`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    retry: (receiptId: string) =>
      request<{
        id: string;
        status: string;
        parsed_output?: ParsedReceipt;
        confidence_map?: unknown;
        validation?: { isValid: boolean; issues: string[]; suggestedFieldsToReview: string[] };
      }>(`/receipts/${receiptId}/retry`, { method: 'POST' }),
    mySplits: () =>
      request<{ id: string; receipt_id: string; amount: number; status: string; created_at: string; group_id: string; group_name: string }[]>(
        '/receipts/splits/me'
      ),
  },
  transactions: {
    list: (groupId: string) =>
      request<{ id: string; status: string; split_mode: string; receipt_id: string | null; allocation_deadline_at: string | null }[]>(
        `/transactions?groupId=${encodeURIComponent(groupId)}`
      ),
    create: (groupId: string, splitMode: 'EVEN_SPLIT' | 'FULL_CONTROL') =>
      request<{ id: string; group_id: string; status: string; split_mode: string; tip_amount: number; allocation_deadline_at: string }>(
        `/groups/${groupId}/transactions`,
        { method: 'POST', body: JSON.stringify({ splitMode }) }
      ),
    get: (id: string) =>
      request<{
        id: string; group_id: string; created_by: string; status: string; split_mode: string;
        tip_amount: number; subtotal: number; total: number; allocation_deadline_at: string | null;
        receipt_id?: string; items: { id: string; name: string; price: number }[];
        claims: Record<string, string[]>; members: { id: string; name: string; email: string }[];
        allocations: { user_id: string; amount: number }[];
      }>(`/transactions/${id}`),
    uploadReceipt: (transactionId: string, file: File | Blob) => {
      const formData = new FormData();
      formData.append('file', file);
      const token = getAccessToken();
      return fetch(`${API_BASE}/transactions/${transactionId}/receipt`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
        body: formData,
      }).then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || `Upload failed (${r.status})`);
        }
        return r.json();
      });
    },
    setSubtotal: (transactionId: string, subtotal: number) =>
      request<{ subtotal: number; total: number }>(`/transactions/${transactionId}/subtotal`, {
        method: 'PUT',
        body: JSON.stringify({ subtotal }),
      }),
    setTip: (transactionId: string, tipAmount: number) =>
      request<{ tip_amount: number; total: number }>(`/transactions/${transactionId}/tip`, {
        method: 'PUT',
        body: JSON.stringify({ tipAmount }),
      }),
    setClaims: (transactionId: string, itemId: string, userIds: string[]) =>
      request<{ userIds: string[] }>(`/transactions/${transactionId}/items/${itemId}/claims`, {
        method: 'PUT',
        body: JSON.stringify({ userIds }),
      }),
    finalize: (transactionId: string) =>
      request<{ ok: boolean; allocations: { user_id: string; amount: number; name: string }[] }>(
        `/transactions/${transactionId}/finalize`,
        { method: 'POST' }
      ),
    settle: (transactionId: string) =>
      request<{ ok: boolean; status: string; allocations: { user_id: string; amount: number; name: string }[] }>(
        `/transactions/${transactionId}/settle`,
        { method: 'POST' }
      ),
    activity: () =>
      request<{ id: string; transaction_id: string; amount: number; group_id: string; status: string; created_at: string; settled_at: string | null; group_name: string }[]>(
        '/transactions/activity/me'
      ),
  },
};
