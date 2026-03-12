import Constants from 'expo-constants';
import { Platform } from 'react-native';

export interface ParsedReceipt {
  merchantName?: string;
  receiptDate?: string | null;
  totals: { subtotal?: number; tax?: number; tip?: number; total?: number };
  lineItems: { name: string; price: number; qty?: number; unitPrice?: number }[];
}

export type UploadAsset = {
  uri: string;
  name: string;
  type: string;
};

export type AppNotification = {
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
  source?: 'server' | 'local';
};

export type User = {
  id: string;
  email: string;
  name: string;
  phone?: string;
  bank_linked: boolean;
  dateOfBirth?: string | null;
  onboardingCompleted?: boolean;
  paymentMethods: PaymentMethod[];
  avatarUrl?: string | null;
};

export type PaymentMethod = {
  id: string;
  type: string;
  last_four: string;
  brand: string | null;
  created_at?: string;
};

export type BootstrapGroup = {
  id: string;
  name: string;
  memberCount: number;
  cardLastFour: string | null;
  lastSettledAt?: string | null;
};

export type VirtualCard = {
  groupId: string;
  groupName: string;
  cardLastFour: string | null;
  active: boolean;
  groupTotal: number;
};

export type GroupDetail = {
  id: string;
  name: string;
  created_by: string;
  members: { id: string; name: string; email: string; avatarUrl?: string }[];
  cardLastFour: string | null;
  inviteToken: string | null;
  supportCode?: string | null;
  lastSettledAt?: string | null;
  splitModePreference?: string;
  draftTipPercentage?: number;
  pendingItemSplit?: { receiptId: string; receiptTotal: number; myAmount: number; draftTipPercentage: number };
  lastSettledAllocations?: { user_id: string; name: string; amount: number }[];
  lastSettledBreakdown?: Record<string, { subtotal: number; tax: number; tip: number }>;
  lastSettledItemsPerUser?: Record<string, { name: string; price: number }[]>;
};

type AuthTokens = {
  accessToken: string | null;
  refreshToken: string | null;
};

const DEFAULT_API_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:3001/api' : 'http://127.0.0.1:3001/api';

const configuredApiUrl =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ||
  ((Constants.manifest2 as { extra?: { expoClient?: { extra?: { apiUrl?: string } } } } | null)?.extra?.expoClient?.extra?.apiUrl as
    | string
    | undefined);

const API_BASE = (configuredApiUrl || process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/+$/, '').endsWith('/api')
  ? (configuredApiUrl || process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/+$/, '')
  : `${(configuredApiUrl || process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/+$/, '')}/api`;

let tokens: AuthTokens = { accessToken: null, refreshToken: null };

export function getApiBase(): string {
  return API_BASE;
}

export function getSocketBase(): string {
  const url = API_BASE.replace(/\/api$/, '');
  return url.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
}

export function assetUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  return `${API_BASE.replace(/\/api$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

export function setAuthTokens(next: Partial<AuthTokens>) {
  tokens = { ...tokens, ...next };
}

export function clearAuthTokens() {
  tokens = { accessToken: null, refreshToken: null };
}

export function getAuthTokens(): AuthTokens {
  return tokens;
}

async function refreshAccessToken(): Promise<boolean> {
  if (!tokens.refreshToken) return false;
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: tokens.refreshToken }),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { accessToken: string };
  setAuthTokens({ accessToken: data.accessToken });
  return true;
}

async function request<T>(
  path: string,
  options: RequestInit & { skipAuth?: boolean; noRefreshOn401?: boolean } = {},
): Promise<T> {
  const { skipAuth, noRefreshOn401, ...rest } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(rest.headers as Record<string, string>),
  };

  if (!skipAuth && tokens.accessToken) {
    headers.Authorization = `Bearer ${tokens.accessToken}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...rest, headers });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Network error');
  }

  if (response.status === 401 && !skipAuth && !noRefreshOn401 && tokens.refreshToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed && tokens.accessToken) {
      headers.Authorization = `Bearer ${tokens.accessToken}`;
      response = await fetch(`${API_BASE}${path}`, { ...rest, headers });
    }
  }

  const text = await response.text();
  const data = text ? (JSON.parse(text) as T & { error?: string; code?: string }) : ({} as T & { error?: string; code?: string });
  if (!response.ok) {
    const error = new Error(data.error || `Request failed: ${response.status}`) as Error & { code?: string };
    if (data.code) error.code = data.code;
    throw error;
  }
  return data as T;
}

function uploadWithProgress<T>(
  path: string,
  file: UploadAsset,
  fields: Record<string, string>,
  onProgress?: (percent: number, phase: 'upload' | 'processing') => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    Object.entries(fields).forEach(([key, value]) => formData.append(key, value));
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as unknown as Blob);

    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (event) => {
      if (!onProgress) return;
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 90), 'upload');
      } else {
        onProgress(45, 'upload');
      }
    });
    xhr.addEventListener('load', () => {
      onProgress?.(100, 'processing');
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as T);
        } catch {
          reject(new Error('Invalid server response'));
        }
        return;
      }
      try {
        const error = JSON.parse(xhr.responseText || '{}') as { error?: string };
        reject(new Error(error.error || `Upload failed (${xhr.status})`));
      } catch {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    });
    xhr.addEventListener('error', () => reject(new Error('Upload failed')));
    xhr.open('POST', `${API_BASE}${path}`);
    if (tokens.accessToken) {
      xhr.setRequestHeader('Authorization', `Bearer ${tokens.accessToken}`);
    }
    xhr.send(formData);
  });
}

export const api = {
  bootstrap: (opts?: { noRefreshOn401?: boolean }) =>
    request<{ user: User; groups: BootstrapGroup[]; virtualCards: VirtualCard[] }>('/bootstrap', opts ?? {}),
  auth: {
    signup: (email: string, password: string, name = '') =>
      request<{ accessToken: string; refreshToken: string; user: { id: string; email: string; name: string } }>('/auth/signup', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({ email, password, name }),
      }),
    login: (email: string, password: string) =>
      request<{ accessToken: string; refreshToken: string; user: { id: string; email: string; name: string } }>('/auth/login', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({ email, password }),
      }),
    sendOtp: (phone: string) =>
      request<{ ok: boolean; code?: string }>('/auth/send-otp', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({ phone }),
      }),
    verifyOtp: (phone: string, code: string, name?: string) =>
      request<{ accessToken: string; refreshToken: string; user: { id: string; email: string; name: string; phone?: string } }>(
        '/auth/verify-otp',
        {
          method: 'POST',
          skipAuth: true,
          body: JSON.stringify({ phone, code, name }),
        },
      ),
    logout: () =>
      request<{ ok: boolean }>('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      }),
  },
  users: {
    me: () => request<User>('/users/me'),
    updateProfile: (payload: { name?: string; email?: string; phone?: string; dateOfBirth?: string; onboardingCompleted?: boolean }) =>
      request<User>('/users/me', { method: 'PATCH', body: JSON.stringify(payload) }),
    notifications: () => request<AppNotification[]>('/users/notifications'),
    registerDeviceToken: (token: string, platform: string) =>
      request<{ ok: boolean }>('/users/device-token', {
        method: 'POST',
        body: JSON.stringify({ token, platform }),
      }),
    linkBank: () => request<{ ok: boolean; bank_linked: boolean }>('/users/link-bank', { method: 'POST' }),
    addPaymentMethod: (type: 'bank' | 'card', lastFour: string, brand?: string) =>
      request<PaymentMethod>('/users/payment-methods', {
        method: 'POST',
        body: JSON.stringify({ type, lastFour, brand }),
      }),
  },
  groups: {
    list: () => request<BootstrapGroup[]>('/groups'),
    create: (name: string, memberEmails?: string[]) =>
      request<{ id: string; name: string; memberCount: number; cardLastFour: string | null; inviteToken: string; supportCode: string }>('/groups', {
        method: 'POST',
        body: JSON.stringify({ name, memberEmails }),
      }),
    get: (groupId: string) => request<GroupDetail>(`/groups/${groupId}`),
    joinPreview: (token: string) => request<{ groupName: string }>(`/groups/join-preview/${token}`, { skipAuth: true }),
    joinByToken: (token: string) =>
      request<{ groupId: string; groupName: string; joined: boolean }>(`/groups/join/${token}`, { method: 'POST' }),
    deleteGroup: (groupId: string) => request<{ ok: boolean }>(`/groups/${groupId}`, { method: 'DELETE' }),
    leaveGroup: (groupId: string) => request<{ ok: boolean }>(`/groups/${groupId}/leave`, { method: 'POST' }),
    removeMember: (groupId: string, memberId: string) =>
      request<{ ok: boolean }>(`/groups/${groupId}/members/${memberId}`, { method: 'DELETE' }),
    updateSplitModePreference: (groupId: string, splitModePreference: 'even' | 'item') =>
      request<{ ok: boolean }>(`/groups/${groupId}`, { method: 'PATCH', body: JSON.stringify({ splitModePreference }) }),
    updateDraftTip: (groupId: string, draftTipPercentage: number) =>
      request<{ ok: boolean }>(`/groups/${groupId}`, { method: 'PATCH', body: JSON.stringify({ draftTipPercentage }) }),
    virtualCards: () => request<VirtualCard[]>('/groups/virtual-cards/list'),
  },
  invites: {
    getByToken: (token: string) =>
      request<{ inviteId: string; groupId: string; groupName: string; inviterName: string; inviteeEmail: string; token: string; createdAt: string }>(
        `/invites/${token}`,
      ),
    accept: (token: string) =>
      request<{ id: string; name: string; createdBy: string; createdAt: string; cardLastFour: string | null; members: { id: string; name: string; email: string }[] }>(
        `/invites/${token}/accept`,
        { method: 'POST' },
      ),
    decline: (token: string) => request<{ ok: boolean }>(`/invites/${token}`, { method: 'DELETE' }),
  },
  plaid: {
    linkToken: () => request<{ linkToken: string }>('/plaid/link-token', { method: 'POST' }),
    exchange: (publicToken: string) =>
      request<{ ok: boolean; paymentMethods: PaymentMethod[] }>('/plaid/exchange', {
        method: 'POST',
        body: JSON.stringify({ public_token: publicToken }),
      }),
  },
  receipts: {
    create: (groupId: string) => request<{ id: string }>('/receipts', { method: 'POST', body: JSON.stringify({ groupId }) }),
    list: (groupId: string) =>
      request<
        { id: string; group_id: string; status: string; total: number | null; created_at: string; transaction_id?: string | null; splits?: { user_id: string; amount: number; status: string; name: string }[] }[]
      >(`/receipts?groupId=${encodeURIComponent(groupId)}`),
    uploadWithProgress: (
      groupId: string,
      file: UploadAsset,
      onProgress: (percent: number, phase: 'upload' | 'processing') => void,
    ) =>
      uploadWithProgress<{
        id: string;
        status: string;
        parsed_output?: ParsedReceipt;
        confidence_map?: Record<string, number | number[]>;
        validation?: { isValid: boolean; issues: string[]; suggestedFieldsToReview: string[] };
      }>('/receipts/upload', file, { groupId }, onProgress),
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
        uploaded_by?: string;
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
        confidence_map?: Record<string, number | number[]>;
        validation?: { isValid: boolean; issues: string[]; suggestedFieldsToReview: string[] };
      }>(`/receipts/${receiptId}/retry`, { method: 'POST' }),
    complete: (receiptId: string) =>
      request<{ ok: boolean; splits: { user_id: string; amount: number; name: string }[] }>(`/receipts/${receiptId}/complete`, { method: 'POST' }),
    mySplits: () =>
      request<{ id: string; receipt_id: string; amount: number; status: string; created_at: string; group_id: string; group_name: string }[]>(
        '/receipts/splits/me',
      ),
  },
  transactions: {
    list: (groupId: string) =>
      request<{ id: string; status: string; split_mode: string; receipt_id: string | null; allocation_deadline_at: string | null }[]>(
        `/transactions?groupId=${encodeURIComponent(groupId)}`,
      ),
    create: (groupId: string, splitMode: 'EVEN_SPLIT' | 'FULL_CONTROL', receiptId?: string) =>
      request<{ id: string; group_id: string; status: string; split_mode: string; tip_amount: number; allocation_deadline_at: string }>(
        `/groups/${groupId}/transactions`,
        { method: 'POST', body: JSON.stringify({ splitMode, ...(receiptId ? { receiptId } : {}) }) },
      ),
    get: (transactionId: string) =>
      request<{
        id: string;
        group_id: string;
        created_by: string;
        status: string;
        split_mode: string;
        tip_amount: number;
        subtotal: number;
        total: number;
        allocation_deadline_at: string | null;
        receipt_id?: string;
        items: { id: string; name: string; price: number }[];
        claims: Record<string, string[]>;
        members: { id: string; name: string; email: string }[];
        allocations: { user_id: string; amount: number }[];
      }>(`/transactions/${transactionId}`),
    uploadReceipt: (transactionId: string, file: UploadAsset, receiptTotal?: number) =>
      uploadWithProgress<{ ok: boolean; receiptId: string }>(
        `/transactions/${transactionId}/receipt`,
        file,
        receiptTotal != null ? { receiptTotal: String(receiptTotal) } : {},
      ),
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
      request<{ ok: boolean; allocations: { user_id: string; amount: number; name: string }[] }>(`/transactions/${transactionId}/finalize`, {
        method: 'POST',
      }),
    settle: (transactionId: string) =>
      request<{ ok: boolean; status: string; allocations: { user_id: string; amount: number; name: string }[] }>(`/transactions/${transactionId}/settle`, {
        method: 'POST',
      }),
    activity: () =>
      request<{ id: string; transaction_id: string; amount: number; group_id: string; status: string; created_at: string; settled_at: string | null; group_name: string }[]>(
        '/transactions/activity/me',
      ),
  },
};
