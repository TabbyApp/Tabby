import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAuthTokens, getSocketBase } from '../lib/api';

type SocketState = {
  lastGroupUpdatedId: string | null;
  lastGroupUpdatedAt: number;
  groupsChangedAt: number;
  activityChangedAt: number;
  lastReceiptClaimsUpdated: { receiptId: string; groupId: string; at: number } | null;
};

const SocketContext = createContext<SocketState>({
  lastGroupUpdatedId: null,
  lastGroupUpdatedAt: 0,
  groupsChangedAt: 0,
  activityChangedAt: 0,
  lastReceiptClaimsUpdated: null,
});

export function SocketProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const [lastGroupUpdatedId, setLastGroupUpdatedId] = useState<string | null>(null);
  const [lastGroupUpdatedAt, setLastGroupUpdatedAt] = useState(0);
  const [groupsChangedAt, setGroupsChangedAt] = useState(0);
  const [activityChangedAt, setActivityChangedAt] = useState(0);
  const [lastReceiptClaimsUpdated, setLastReceiptClaimsUpdated] = useState<SocketState['lastReceiptClaimsUpdated']>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const { accessToken } = getAuthTokens();
    if (!accessToken) return;
    const socket = io(getSocketBase(), {
      path: '/socket.io',
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('groups:changed', () => setGroupsChangedAt(Date.now()));
    socket.on('group:updated', (payload: { groupId?: string }) => {
      if (!payload?.groupId) return;
      setLastGroupUpdatedId(payload.groupId);
      setLastGroupUpdatedAt(Date.now());
    });
    socket.on('activity:changed', () => setActivityChangedAt(Date.now()));
    socket.on('receipt:claims-updated', (payload: { receiptId?: string; groupId?: string }) => {
      if (!payload?.receiptId || !payload?.groupId) return;
      setLastReceiptClaimsUpdated({ receiptId: payload.receiptId, groupId: payload.groupId, at: Date.now() });
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [enabled]);

  const value = useMemo(
    () => ({
      lastGroupUpdatedId,
      lastGroupUpdatedAt,
      groupsChangedAt,
      activityChangedAt,
      lastReceiptClaimsUpdated,
    }),
    [activityChangedAt, groupsChangedAt, lastGroupUpdatedAt, lastGroupUpdatedId, lastReceiptClaimsUpdated],
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocketState() {
  return useContext(SocketContext);
}
