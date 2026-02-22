import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAccessToken } from '../lib/api';
import { getSocketUrl } from '../lib/socketUrl';

type SocketContextValue = {
  lastGroupUpdatedId: string | null;
  /** Timestamp when group:updated was last emitted; use so each event triggers refetch even for same groupId */
  lastGroupUpdatedAt: number;
  /** Timestamp when groups:changed was last emitted (e.g. someone joined/left); group detail should refetch when this changes */
  groupsChangedAt: number;
  activityInvalidatedAt: number;
};

const SocketContext = createContext<SocketContextValue | null>(null);

type SocketProviderProps = {
  children: React.ReactNode;
  enabled: boolean;
  onGroupsChanged?: () => void;
  onGroupUpdated?: (groupId: string) => void;
  onActivityChanged?: () => void;
  onRemovedFromGroup?: (groupId: string) => void;
  onGroupDeleted?: (groupId: string) => void;
};

export function SocketProvider({
  children,
  enabled,
  onGroupsChanged,
  onGroupUpdated,
  onActivityChanged,
  onRemovedFromGroup,
  onGroupDeleted,
}: SocketProviderProps) {
  const [lastGroupUpdatedId, setLastGroupUpdatedId] = useState<string | null>(null);
  const [lastGroupUpdatedAt, setLastGroupUpdatedAt] = useState(0);
  const [groupsChangedAt, setGroupsChangedAt] = useState(0);
  const [activityInvalidatedAt, setActivityInvalidatedAt] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const callbacksRef = useRef({ onGroupsChanged, onGroupUpdated, onActivityChanged, onRemovedFromGroup, onGroupDeleted });
  callbacksRef.current = { onGroupsChanged, onGroupUpdated, onActivityChanged, onRemovedFromGroup, onGroupDeleted };

  useEffect(() => {
    if (!enabled) return;
    const token = getAccessToken();
    if (!token) return;

    const url = getSocketUrl();
    if (!url) return;

    const socket = io(url, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('groups:changed', () => {
      setGroupsChangedAt(Date.now());
      callbacksRef.current.onGroupsChanged?.();
    });

    socket.on('group:updated', (payload: { groupId?: string }) => {
      const groupId = payload?.groupId;
      if (groupId) {
        setLastGroupUpdatedId(groupId);
        setLastGroupUpdatedAt(Date.now());
        callbacksRef.current.onGroupUpdated?.(groupId);
      }
    });

    socket.on('activity:changed', () => {
      setActivityInvalidatedAt((t) => Date.now());
      callbacksRef.current.onActivityChanged?.();
    });

    socket.on('removed-from-group', (payload: { groupId?: string }) => {
      if (payload?.groupId) callbacksRef.current.onRemovedFromGroup?.(payload.groupId);
    });

    socket.on('group-deleted', (payload: { groupId?: string }) => {
      if (payload?.groupId) callbacksRef.current.onGroupDeleted?.(payload.groupId);
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [enabled]);

  return (
    <SocketContext.Provider value={{ lastGroupUpdatedId, lastGroupUpdatedAt, groupsChangedAt, activityInvalidatedAt }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) return { lastGroupUpdatedId: null, lastGroupUpdatedAt: 0, groupsChangedAt: 0, activityInvalidatedAt: 0 };
  return ctx;
}
